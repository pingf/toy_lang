import {BUILTIN_FUNCTIONS} from './builtin/functions.js';
import {BUILTIN_CLASSES} from './builtin/classes.js';

export {Context};

const BUILTINS = new Map(
    Array.from(BUILTIN_FUNCTIONS.entries()).concat(
        Array.from(BUILTIN_CLASSES.entries())
    )
); 

const RUNTIME_CHECKER = {
    refErrIfNoValue(v, name) {
        if(!v) {
            throw new ReferenceError(`${name} is not defined`);
        }
    }
};

class Context {
    constructor(parent, output = nope, variables = new Map(), returnedValue = null) {
        this.parent = parent;
        this.output = output;
        this.variables = variables;
        this.returnedValue = returnedValue;
    }

    static initialize(environment) {
        return new Context(null, environment.output, new Map(BUILTINS));
    }

    childContext() {
        return new Context(this, this.output)
    }

    output(value) {
        this.output(value);
        return this;
    }

    // For simple support for closure, the 'assign' method changes the state directly.
    assign(variable, value) {
        this.variables.set(variable, value);
        return this;
    }

    returned(value) {
        return new Context(
            this.parent,
            this.output,
            this.variables,
            value
        );
    }

    lookUpVariable(name) {
        const value = this.variables.get(name);
        if(value !== undefined) {
            return value;
        }
        
        RUNTIME_CHECKER.refErrIfNoValue(this.parent, name);
        return this.parent.lookUpVariable(name);
    }   
    
    get RUNTIME_CHECKER() {
        return RUNTIME_CHECKER;
    }
}
