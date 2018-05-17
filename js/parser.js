import {Stack} from './util.js';
import {Value, Void} from './ast/value.js';
import {Func, Return, FunCall, FunCallWrapper} from './ast/function.js';
import {BINARY_OPERATORS, UNARY_OPERATORS} from './ast/operator.js';
import {Variable, Assign, While, If, StmtSequence} from './ast/statement.js';
export {Parser};

class ParserInterceptor {
    constructor(parser) {
        this.parser = parser;
    }

    parse(lines) {
        try {
            return this.parser.parse(lines);
        } 
        catch(ex) {
            if(ex instanceof SyntaxError) {
                throw ex;
            }
            throw new SyntaxError(`\n\t${lines[0].toString()}`);
        }
    }
}

const LINE_PARSERS = new Map([
    ['sequence', new ParserInterceptor({
        parse(lines) {
            if(lines.length === 0 || lines[0].code === 'else' || lines[0].code === 'end') {
                return StmtSequence.EMPTY;
            }
    
            return LINE_PARSERS.get('assign').parse(lines);   
        }
    })], 
    ['assign', {
        parse(lines) {
            let matched = lines[0].tryTokens('assign');
            if(matched.length !== 0) {
                let [variableName, _, assigned] = matched;
                return new StmtSequence(
                    new Assign(
                        new Variable(variableName), 
                        VALUE_PARSERS.get('value').parse(lines[0].valuablePart(assigned))
                    ),
                    LINE_PARSERS.get('sequence').parse(lines.slice(1))
                );
            }

            return LINE_PARSERS.get('funcall').parse(lines);
        }
    }],      
    ['funcall', {
        parse(lines) {
            let matched = lines[0].tryTokens('funcall');
            if(matched.length !== 0) {
                let [funcName, ...args] = matched;
                return new StmtSequence(
                    new FunCallWrapper(
                        new FunCall(
                            new Variable(funcName),
                            args.map(arg => VALUE_PARSERS.get('value').parse(lines[0].valuablePart(arg))) 
                        )
                    ),
                    LINE_PARSERS.get('sequence').parse(lines.slice(1))
                );                
            }

            return LINE_PARSERS.get('def').parse(lines);
        }
    }],        
    ['def', {
        parse(lines) {
            let [command, arg] = lines[0].tryTokens('command');
            if(command === 'def') {
                let [funcName, ...params] = lines[0].valuablePart(arg).tryTokens('func');
                let remains = lines.slice(1);     
                return new StmtSequence(
                    new Assign(
                        new Variable(funcName), 
                        new Func(params.map(param => new Variable(param)), LINE_PARSERS.get('sequence').parse(remains))
                    ),
                    LINE_PARSERS.get('sequence').parse(linesAfterCurrentBlock(remains))
                );    
            }
            
            return LINE_PARSERS.get('return').parse(lines);
        }
    }],   
    ['return', {
        parse(lines) {
            let [command, arg] = lines[0].tryTokens('command');
            if(command === 'return') {
                return new StmtSequence(
                    new Return(arg === '' ? Void : VALUE_PARSERS.get('value').parse(lines[0].valuablePart(arg))),
                    LINE_PARSERS.get('sequence').parse(lines.slice(1))
                );
            }
            
            return LINE_PARSERS.get('if').parse(lines);           
        }
    }],           
    ['if', {
        parse(lines) {
            let [command, arg] = lines[0].tryTokens('command');
            if(command === 'if') {
                let remains = lines.slice(1);     
                let trueStmt = LINE_PARSERS.get('sequence').parse(remains);
    
                let i = matchingElseIdx(trueStmt);
                let falseStmt = remains[i].code === 'else' ? 
                        LINE_PARSERS.get('sequence').parse(remains.slice(i + 1)) : 
                        StmtSequence.EMPTY;
    
                return new StmtSequence(
                     new If(
                        VALUE_PARSERS.get('boolean').parse(lines[0].valuablePart(arg)), 
                        trueStmt,
                        falseStmt
                     ),
                     LINE_PARSERS.get('sequence').parse(linesAfterCurrentBlock(remains))
                );
            }
            return LINE_PARSERS.get('while').parse(lines); 
        }
    }],
    ['while', {
        parse(lines) {
            let [command, arg] = lines[0].tryTokens('command');
            if(command === 'while') {
                let remains = lines.slice(1);     
                return new StmtSequence(
                     new While(
                        VALUE_PARSERS.get('boolean').parse(lines[0].valuablePart(arg)), 
                        LINE_PARSERS.get('sequence').parse(remains)
                     ),
                     LINE_PARSERS.get('sequence').parse(linesAfterCurrentBlock(remains))
                );                
            }
            throw new SyntaxError(`\n\t${lines[0].toString()}`);
        }
    }]
]);

function matchingElseIdx(stmt, i = 1) {
    if(stmt.secondStmt === StmtSequence.EMPTY) {
        return i;
    }
    return matchingElseIdx(stmt.secondStmt, i + 1);
}

function linesAfterCurrentBlock(lines, end = 1) {
    if(end === 0) {
        return lines;
    }

    if(lines[0].code === 'end') {
        return linesAfterCurrentBlock(lines.slice(1), end - 1);
    }

    if(lines[0].code === 'else') {
        return linesAfterCurrentBlock(lines.slice(1), end);
    }

    let rpts = lines[0].code.startsWith('if') || lines[0].code.startsWith('while') || lines[0].code.startsWith('def') ? end + 1 : end;
    
    return linesAfterCurrentBlock(lines.slice(1), rpts)
}

const VALUE_PARSERS = new Map([
    ['value', {
        parse(valueTester) {
            // pattern matching from text
            return VALUE_PARSERS.get('text').parse(valueTester);
        }
    }],
    ['text', {
        parse(valueTester) {
            let [text] = valueTester.tryTokens('text');
            return text === undefined ? 
                      VALUE_PARSERS.get('num').parse(valueTester) : 
                      new Value(text.replace(/^\\r/, '\r')
                                    .replace(/^\\n/, '\n')
                                    .replace(/([^\\])\\r/g, '$1\r')
                                    .replace(/([^\\])\\n/g, '$1\n')
                                    .replace(/^\\t/, '\t')
                                    .replace(/([^\\])\\t/g, '$1\t')
                                    .replace(/\\\\/g, '\\')
                                    .replace(/\\'/g, '\'')
                      );
        }
    }],
    ['num', {
        parse(valueTester) {
            let [number] = valueTester.tryTokens('number');
            return number === undefined ? VALUE_PARSERS.get('boolean').parse(valueTester) : new Value(parseFloat(number));
        }        
    }],
    ['boolean', {
        parse(valueTester) {
            let [boolean] = valueTester.tryTokens('boolean');
            return boolean === undefined ? VALUE_PARSERS.get('variable').parse(valueTester) : new Value(boolean === 'true');
        }        
    }],    
    ['variable', {
        parse(valueTester) {
            let [variable] = valueTester.tryTokens('variable');
            return variable === undefined ?  VALUE_PARSERS.get('funcall').parse(valueTester) : new Variable(variable);
        }
    }],
    ['funcall', {
        parse(valueTester) {
            let funcallTokens = valueTester.tryTokens('funcall');
            if(funcallTokens.length !== 0) {
                let [fName, ...args] = funcallTokens;
                return new FunCall(
                    new Variable(fName), 
                    args.map(arg => VALUE_PARSERS.get('value').parse(valueTester.valueTester(arg)))
                )
            }

            return VALUE_PARSERS.get('expression').parse(valueTester);
        }        
    }],    
    ['expression', {
        parse(valueTester) {
            let tokens = valueTester.tryTokens('postfixExprTokens');
            return tokens.reduce((stack, token) => {
                if(isOperator(token)) {
                    return reduce(stack, token);
                } 
                else if(token.startsWith('not')) {
                    let [not, operand] = valueTester.valueTester(token).tryTokens('not');
                    let NotOperator = UNARY_OPERATORS.get(not);
                    return stack.push(
                        new NotOperator(
                            VALUE_PARSERS.get('value').parse(valueTester.valueTester(operand))
                        )
                    );
                }
                return stack.push(
                    VALUE_PARSERS.get('value').parse(valueTester.valueTester(token))
                );
            }, new Stack()).top;
        }
    }]
]);

function isOperator(token) {        
    return ['==', '!=', '>=', '>', '<=', '<',
            'and', 'or', 
            '+', '-', '*', '/', '%'].indexOf(token) !== -1;
}

function reduce(stack, token) {
    let right = stack.top;
    let s1 = stack.pop();
    let left = s1.top;
    let s2 = s1.pop();
    let Operator = BINARY_OPERATORS.get(token);
    return s2.push(new Operator(left, right));
}

class Parser {
    constructor(environment) {
        this.environment = environment;  
    }

    parse(tokenizer) {
        try {
            return LINE_PARSERS.get('sequence').parse(tokenizer.lines());
        }
        catch(ex) {
            this.environment.output(ex);
            throw ex;
        }
    }
}
