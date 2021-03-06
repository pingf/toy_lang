import {Primitive} from './value.js';
import {Stmt} from './statement.js';

export {Variable, VariableAssign, DefStmt, ClassStmt, NonlocalAssign, PropertyAssign};

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

class VariableAssign extends Stmt {
    constructor(variable, value, operator) {
        super(1);
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
             return context.assign(this.variable.name, value);
        });
    }
}

class DefStmt extends Stmt {
    constructor(variable, value) {
        super(value.stmt.lineCount + 2);
        this.variableAssign = new VariableAssign(variable, value);
    }

    evaluate(context) {
        return this.variableAssign.evaluate(context);
    }
}

function classLineCount(value) {
    const notDefStmtLineCount = value.stmt.lineCount;
    const defLineCount = Array.from(value.methods.values())
                              .map(func => func.stmt.lineCount + 2)
                              .reduce((acc, n) => n + acc, 0);        
    return notDefStmtLineCount + defLineCount + 2;    
}
class ClassStmt extends Stmt {
    constructor(variable, value) {
        super(classLineCount(value));
        this.variableAssign = new VariableAssign(variable, value);
    }

    evaluate(context) {
        return this.variableAssign.evaluate(context);
    }
}

class NonlocalAssign extends Stmt {
    constructor(variable, value, operator) {
        super(1);
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

class PropertyAssign extends Stmt {
    constructor(target, propName, value, operator) {
        super(1);
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
