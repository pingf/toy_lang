import {Thrown, Instance, Primitive} from './value.js';

export {ExprWrapper, Variable, VariableAssign, NonlocalAssign, PropertyAssign, While, If, Switch, StmtSequence, Return, Throw, Try};

class ExprWrapper {
    constructor(expr) {
        this.expr = expr;
    }

    evaluate(context) {
        const maybeContext = this.expr.evaluate(context);
        return maybeContext.notThrown(_ => context);
    }    
}

const variables = new Map();

class Variable {
    constructor(name) {
        this.name = name;
    }

    evaluate(context) {
        return context.lookUpVariable(this.name);
    }

    send(context, instance) {
        return instance.getProperty(context, this.name).evaluate(context);
    }

    static of(name) {
        if(variables.has(name)) {
            return variables.get(name);
        }
        const variable = new Variable(name);
        variables.set(name, variable);
        return variable;
    }
}

function p(v) {
    return new Primitive(v);
}

const ARITHMETIC_OPERATORS = new Map([
    ['+', (a, b) => p(a.value + b.value)],
    ['-', (a, b) => p(a.value - b.value)],
    ['*', (a, b) => p(a.value * b.value)],
    ['/', (a, b) => p(a.value / b.value)],
    ['%', (a, b) => p(a.value % b.value)],
    ['&', (a, b) => p(a.value & b.value)],
    ['|', (a, b) => p(a.value | b.value)],
    ['^', (a, b) => p(a.value ^ b.value)],
    ['<<', (a, b) => p(a.value << b.value)],
    ['>>', (a, b) => p(a.value >> b.value)]
]);

class VariableAssign {
    constructor(variable, value, operator) {
        this.variable = variable;
        this.value = value;
        this.operator = operator;
    }

    evaluate(context) {
        const maybeContext = this.value.evaluate(context);
        return maybeContext.notThrown(value => {
             if(this.operator) {
                return context.assign(
                    this.variable.name, 
                    ARITHMETIC_OPERATORS.get(this.operator)(this.variable.evaluate(context), value)
                );
             }
             return context.assign(
                 this.variable.name, value
             );
        });
    }

    static assigns(variables, values) {
        if(variables.length === 0) {
            return StmtSequence.EMPTY;
        }
        return new StmtSequence(
                      new VariableAssign(variables[0], values[0]), 
                      VariableAssign.assigns(variables.slice(1), values.slice(1))
                );
    }    
}

class NonlocalAssign {
    constructor(variable, value, operator) {
        this.variable = variable;
        this.value = value;
        this.operator = operator;
    }

    evaluate(context) {
        const maybeContext = this.value.evaluate(context);
        return maybeContext.notThrown(value => {
            if(this.operator) {
                return setParentVariable(
                    context, 
                    this.variable.name, 
                    ARITHMETIC_OPERATORS.get(this.operator)(this.variable.evaluate(context), value)
                );
             }
             return setParentVariable(context, this.variable.name, value);
        });
    }
}

function setParentVariable(context, name, value) {
    const parent = context.parent;
    const v = parent.variables.get(name);
    if(v !== undefined) {
        parent.assign(name, value);
        return context;
    }
    
    RUNTIME_CHECKER.refErrIfNoValue(parent.parent, name);
    return setParentVariable(parent, name, value);
}   

class While {
    constructor(boolean, stmt) {
        this.boolean = boolean;
        this.stmt = stmt;
    }

    evaluate(context) {
        const maybeContext = this.boolean.evaluate(context);
        return maybeContext.notThrown(v => {
            if(v.value) {
                const ctx = this.stmt.evaluate(context);
                return this.evaluate(ctx);
            }
    
            return context;
        });
    }   
}

class If {
    constructor(boolean, trueStmt, falseStmt) {
        this.boolean = boolean;
        this.trueStmt = trueStmt;
        this.falseStmt = falseStmt;
    }

    evaluate(context) {
        const maybeContext = this.boolean.evaluate(context);
        return maybeContext.notThrown(v => {
            if(v.value) {
                return this.trueStmt.evaluate(context);
            }
            return this.falseStmt.evaluate(context);
        });
    }   
}

class Switch {
    constructor(switchValue, cases, defaultStmt) {
        this.switchValue = switchValue;
        this.cases = cases;
        this.defaultStmt = defaultStmt;
    }

    evaluate(context) {
        const maybeContext = this.switchValue.evaluate(context);
        return maybeContext.notThrown(v => {
            const maybeCtx = compareCases(context, v, this.cases);
            if(maybeCtx) {
                return maybeCtx;
            }
            return this.defaultStmt.evaluate(context);
        });
    }   
}

function compareCases(context, switchValue, cases) {
    if(cases.length === 0) {
        return false;  // no matched case
    }
    const cazeValues = cases[0][0];
    const cazeStmt = cases[0][1];
    const maybeContext = compareCaseValues(context, switchValue, cazeValues, cazeStmt);
    return maybeContext ? maybeContext : compareCases(context, switchValue, cases.slice(1));
}

function compareCaseValues(context, switchValue, cazeValues, cazeStmt) {
    if(cazeValues.length === 0) {
        return false; // no matched value
    }
    const v = cazeValues[0].evaluate(context);
    if(v.value === switchValue.value) {
        return cazeStmt.evaluate(context);
    }
    return compareCaseValues(context, switchValue, cazeValues.slice(1), cazeStmt);
}

class StmtSequence {
    constructor(firstStmt, secondStmt, lineNumber) {
        this.firstStmt = firstStmt;
        this.secondStmt = secondStmt;
        this.lineNumber = lineNumber;
    }

    evaluate(context) {
        try {
            const ctx = this.firstStmt.evaluate(context);
            return ctx.either(
                leftContext => {
                    if(leftContext.thrownNode.stackTraceElements.length === 0 || 
                       context !== leftContext.thrownContext) {
                        leftContext.thrownNode.addStackTraceElement({
                            fileName : context.fileName,
                            lineNumber : this.lineNumber,
                            statement : context.stmtMap.get(this.lineNumber)
                        });
                    }
                    return leftContext;
                },
                rightContext =>  rightContext.notReturn(c => this.secondStmt.evaluate(c))
            );
        } catch(e) {
            if(this.lineNumber) {
                addStackTrace(context, e, {
                    fileName : context.fileName,
                    lineNumber : this.lineNumber,
                    statement : context.stmtMap.get(this.lineNumber)
                });
            }
            throw e;
        }
    }
}

function addStackTrace(context, e, strackTraceElement) {
    if(!e.strackTraceElements) {
        e.strackTraceElements = [strackTraceElement];
        e.context = context;
    }
    if(e.context !== context) {
        e.context = context;
        e.strackTraceElements.push(strackTraceElement);
    }
}

StmtSequence.EMPTY = {
    // We don't care about emtpy statements so the lineNumber 0 is enough.
    lineNumber : 0, 
    evaluate(context) {
        return context;
    }
};

class PropertyAssign {
    constructor(target, propName, value, operator) {
        this.target = target;
        this.propName = propName;
        this.value = value;
        this.operator = operator;
    }

    evaluate(context) {
        const maybeContextInstance = this.target.evaluate(context);
        return maybeContextInstance.notThrown(instance => { 
            const maybeContextValue  = this.value.evaluate(context);
            return maybeContextValue.notThrown(value => {
                instance.setOwnProperty(
                    this.propName, 
                    this.operator ? 
                        ARITHMETIC_OPERATORS.get(this.operator)(instance.getOwnProperty(this.propName), value) : 
                        value 
                );
                return context;
            });
        });
    }
}


class Return {
    constructor(value) {
        this.value = value;
    }

    evaluate(context) {
        const maybeCtx = this.value.evaluate(context);
        return maybeCtx.notThrown(value => context.returned(value));
    }    
}

class Throw {
    constructor(value) {
        this.value = value;
    }

    evaluate(context) {
        const maybeCtx = this.value.evaluate(context);
        return maybeCtx.notThrown(v => {
            return context.thrown(new Thrown(v));
        });
    }    
}

class Try {
    constructor(tryStmt, exceptionVar, catchStmt) {
        this.tryStmt = tryStmt;
        this.exceptionVar = exceptionVar;
        this.catchStmt = catchStmt;
    }

    evaluate(context) {
        const maybeContext = this.tryStmt.evaluate(context);
        if(maybeContext.thrownNode) {
            const thrownValue = maybeContext.thrownNode.value;
            if(thrownValue.hasOwnProperty && thrownValue.hasOwnProperty('stackTraceElements')) {
                const stackTraceElements = thrownValue.getOwnProperty('stackTraceElements').nativeValue();
                maybeContext.thrownNode
                            .stackTraceElements
                            .map(elem => {
                                return new Instance(
                                    context.lookUpVariable('Object'),
                                    new Map([
                                        ['fileName', new Primitive(elem.fileName)],
                                        ['lineNumber', new Primitive(elem.lineNumber)],
                                        ['statement', new Primitive(elem.statement)]
                                    ])
                                );
                            })
                            .forEach(elem => stackTraceElements.push(elem));
            }

            const ctx = new StmtSequence(
                new VariableAssign(this.exceptionVar, thrownValue),
                this.catchStmt, 
                this.catchStmt.lineNumber
            ).evaluate(maybeContext.emptyThrown());
        
            return ctx.deleteVariable(this.exceptionVar.name);
        }
        return context;
    }   
}