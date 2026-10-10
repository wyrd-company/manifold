// ---
// relationships:
//   realizes: blueprint
// ---
// Generated; do not edit.
// Schema digest: fd8bba9e9e773ff029dc2a498a56a5d0d2eff5ab8d745001bdd0b915dfaf8980
"use strict";
export const validate = validate20;
export default validate20;
const schema31 = { $ref: "https://manifold.wyrd.company/schemas/blueprint#/$defs/blueprint" };
const schema33 = {
  description: "One blueprint file.",
  type: "object",
  required: ["machine", "schemas"],
  additionalProperties: false,
  properties: {
    description: { type: "string" },
    machine: { $ref: "#/$defs/machine" },
    schemas: {
      $ref: "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-schemas",
    },
    layout: { $ref: "#/$defs/layout" },
    migrations: {
      description:
        "The migration paths from an earlier version's context to this version's. The machine never reads them.",
      type: "array",
      items: { $ref: "#/$defs/migration-path" },
    },
  },
};
const schema34 = {
  description:
    "The root state node of the machine configuration, with the machine id and the initial context.",
  type: "object",
  allOf: [{ $ref: "#/$defs/state-node-properties" }],
  propertyNames: {
    enum: [
      "description",
      "type",
      "initial",
      "history",
      "target",
      "states",
      "on",
      "always",
      "after",
      "onDone",
      "entry",
      "exit",
      "invoke",
      "meta",
      "tags",
      "output",
      "id",
      "context",
    ],
  },
  properties: {
    context: {
      description: "The initial context. `manifold` is the engine's.",
      type: "object",
      not: { required: ["manifold"] },
    },
  },
};
const schema35 = {
  description: "The keys a state node shares with the root.",
  type: "object",
  properties: {
    id: { type: "string", minLength: 1 },
    description: { type: "string" },
    type: { enum: ["atomic", "compound", "parallel", "final", "history"] },
    initial: { $ref: "#/$defs/state-key" },
    history: { enum: ["shallow", "deep"] },
    target: { $ref: "#/$defs/targets" },
    states: {
      type: "object",
      propertyNames: { $ref: "#/$defs/state-key" },
      additionalProperties: { $ref: "#/$defs/state-node" },
    },
    on: { type: "object", additionalProperties: { $ref: "#/$defs/transitions" } },
    always: { $ref: "#/$defs/transitions" },
    after: {
      type: "object",
      propertyNames: {
        description: "A delay in milliseconds as decimal digits, or a delay implementation name.",
        minLength: 1,
      },
      additionalProperties: { $ref: "#/$defs/transitions" },
    },
    onDone: { $ref: "#/$defs/transitions" },
    entry: { $ref: "#/$defs/actions" },
    exit: { $ref: "#/$defs/actions" },
    invoke: {
      oneOf: [{ $ref: "#/$defs/invoke" }, { type: "array", items: { $ref: "#/$defs/invoke" } }],
    },
    meta: { type: "object", properties: { gate: { $ref: "#/$defs/gate-declaration" } } },
    tags: { oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] },
    output: {
      description:
        "On a top-level final state, the machine's output: static, or an `expression.map`.",
      $ref: "#/$defs/value-or-mapping",
    },
  },
};
const schema36 = {
  description: "A state key. Targets and state paths separate keys with `.` and ids with `#`.",
  type: "string",
  minLength: 1,
  pattern: "^[^.#]+$",
};
const schema37 = {
  oneOf: [
    { type: "string", minLength: 1 },
    { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
  ],
};
const func1 = (value) => [...value].length;
const pattern4 = new RegExp("^[^.#]+$", "u");
const schema39 = {
  type: "object",
  allOf: [{ $ref: "#/$defs/state-node-properties" }],
  propertyNames: {
    enum: [
      "description",
      "type",
      "initial",
      "history",
      "target",
      "states",
      "on",
      "always",
      "after",
      "onDone",
      "entry",
      "exit",
      "invoke",
      "meta",
      "tags",
      "output",
      "id",
    ],
  },
};
const wrapper0 = { validate: validate24 };
function validate25(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate25.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (
    !wrapper0.validate(data, {
      instancePath,
      parentData,
      parentDataProperty,
      rootData,
      dynamicAnchors,
    })
  ) {
    vErrors =
      vErrors === null ? wrapper0.validate.errors : vErrors.concat(wrapper0.validate.errors);
    errors = vErrors.length;
  } else {
    var props0 = wrapper0.validate.evaluated.props;
    var items0 = wrapper0.validate.evaluated.items;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      for (const key0 in data) {
        const _errs2 = errors;
        if (
          !(
            key0 === "description" ||
            key0 === "type" ||
            key0 === "initial" ||
            key0 === "history" ||
            key0 === "target" ||
            key0 === "states" ||
            key0 === "on" ||
            key0 === "always" ||
            key0 === "after" ||
            key0 === "onDone" ||
            key0 === "entry" ||
            key0 === "exit" ||
            key0 === "invoke" ||
            key0 === "meta" ||
            key0 === "tags" ||
            key0 === "output" ||
            key0 === "id"
          )
        ) {
          const err0 = {
            instancePath,
            schemaPath: "#/propertyNames/enum",
            keyword: "enum",
            params: { allowedValues: schema39.propertyNames.enum },
            message: "must be equal to one of the allowed values",
            propertyName: key0,
          };
          if (vErrors === null) {
            vErrors = [err0];
          } else {
            vErrors.push(err0);
          }
          errors++;
        }
        var valid1 = _errs2 === errors;
        if (!valid1) {
          const err1 = {
            instancePath,
            schemaPath: "#/propertyNames",
            keyword: "propertyNames",
            params: { propertyName: key0 },
            message: "property name must be valid",
          };
          if (vErrors === null) {
            vErrors = [err1];
          } else {
            vErrors.push(err1);
          }
          errors++;
          validate25.errors = vErrors;
          return false;
          break;
        }
      }
    } else {
      validate25.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate25.errors = vErrors;
  evaluated0.props = props0;
  evaluated0.items = items0;
  return errors === 0;
}
validate25.evaluated = { dynamicProps: true, dynamicItems: true };
const schema40 = {
  oneOf: [{ $ref: "#/$defs/transition" }, { type: "array", items: { $ref: "#/$defs/transition" } }],
};
const schema41 = {
  oneOf: [
    { type: "string", minLength: 1 },
    {
      type: "object",
      additionalProperties: false,
      properties: {
        target: { $ref: "#/$defs/targets" },
        guard: { $ref: "#/$defs/guard" },
        actions: { $ref: "#/$defs/actions" },
        reenter: { type: "boolean" },
        description: { type: "string" },
        meta: { type: "object" },
      },
    },
  ],
};
const schema43 = {
  description:
    "A guard: an implementation reference, an expression reference, or the built-in `in` guard, which is never written by its bare name.",
  allOf: [
    { $ref: "#/$defs/reference" },
    { not: { const: "in" } },
    {
      if: { type: "object", required: ["type"], properties: { type: { const: "in" } } },
      then: { $ref: "#/$defs/in-guard" },
    },
  ],
};
const schema44 = {
  description:
    "An implementation referenced by name, with optional parameters, or an expression reference. An expression implementation is never referenced by its bare name.",
  oneOf: [
    { $ref: "#/$defs/implementation-name" },
    {
      type: "object",
      required: ["type"],
      additionalProperties: false,
      properties: { type: { $ref: "#/$defs/implementation-name" }, params: { type: "object" } },
    },
    {
      $ref: "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference",
    },
  ],
};
const schema45 = {
  description:
    "The name of an implementation that code registers. Names beginning with `expression.` belong to the expression implementations.",
  type: "string",
  minLength: 1,
  not: { pattern: "^expression\\." },
};
const schema48 = {
  description:
    "A JSONata expression carried as the parameter of a generic implementation. Guards and matches stand where XState accepts a guard, assignments where it accepts an action, and mappings as the value of `input` on an invoke, `output` on a top-level final state, or `context` on a blueprint's migration path.",
  type: "object",
  required: ["type", "params"],
  additionalProperties: false,
  properties: {
    type: { enum: ["expression.guard", "expression.match", "expression.assign", "expression.map"] },
    params: {
      type: "object",
      required: ["expression"],
      additionalProperties: false,
      properties: {
        expression: { description: "The JSONata source.", type: "string", minLength: 1 },
      },
    },
  },
};
const pattern6 = new RegExp("^expression\\.", "u");
function validate30(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate30.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  const _errs2 = errors;
  const _errs4 = errors;
  const _errs5 = errors;
  if (typeof data === "string") {
    if (!pattern6.test(data)) {
      const err0 = {};
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
  }
  var valid2 = _errs5 === errors;
  if (valid2) {
    const err1 = {
      instancePath,
      schemaPath: "#/$defs/implementation-name/not",
      keyword: "not",
      params: {},
      message: "must NOT be valid",
    };
    if (vErrors === null) {
      vErrors = [err1];
    } else {
      vErrors.push(err1);
    }
    errors++;
  } else {
    errors = _errs4;
    if (vErrors !== null) {
      if (_errs4) {
        vErrors.length = _errs4;
      } else {
        vErrors = null;
      }
    }
  }
  if (errors === _errs2) {
    if (typeof data === "string") {
      if (func1(data) < 1) {
        const err2 = {
          instancePath,
          schemaPath: "#/$defs/implementation-name/minLength",
          keyword: "minLength",
          params: { limit: 1 },
          message: "must NOT have fewer than 1 characters",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    } else {
      const err3 = {
        instancePath,
        schemaPath: "#/$defs/implementation-name/type",
        keyword: "type",
        params: { type: "string" },
        message: "must be string",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
  }
  const _errs6 = errors;
  if (errors === _errs6) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.type === undefined && (missing0 = "type")) {
        const err4 = {
          instancePath,
          schemaPath: "#/oneOf/1/required",
          keyword: "required",
          params: { missingProperty: missing0 },
          message: "must have required property '" + missing0 + "'",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      } else {
        const _errs8 = errors;
        for (const key0 in data) {
          if (!(key0 === "type" || key0 === "params")) {
            const err5 = {
              instancePath,
              schemaPath: "#/oneOf/1/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key0 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err5];
            } else {
              vErrors.push(err5);
            }
            errors++;
            break;
          }
        }
        if (_errs8 === errors) {
          if (data.type !== undefined) {
            let data0 = data.type;
            const _errs9 = errors;
            const _errs10 = errors;
            const _errs12 = errors;
            const _errs13 = errors;
            if (typeof data0 === "string") {
              if (!pattern6.test(data0)) {
                const err6 = {};
                if (vErrors === null) {
                  vErrors = [err6];
                } else {
                  vErrors.push(err6);
                }
                errors++;
              }
            }
            var valid5 = _errs13 === errors;
            if (valid5) {
              const err7 = {
                instancePath: instancePath + "/type",
                schemaPath: "#/$defs/implementation-name/not",
                keyword: "not",
                params: {},
                message: "must NOT be valid",
              };
              if (vErrors === null) {
                vErrors = [err7];
              } else {
                vErrors.push(err7);
              }
              errors++;
            } else {
              errors = _errs12;
              if (vErrors !== null) {
                if (_errs12) {
                  vErrors.length = _errs12;
                } else {
                  vErrors = null;
                }
              }
            }
            if (errors === _errs10) {
              if (typeof data0 === "string") {
                if (func1(data0) < 1) {
                  const err8 = {
                    instancePath: instancePath + "/type",
                    schemaPath: "#/$defs/implementation-name/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err8];
                  } else {
                    vErrors.push(err8);
                  }
                  errors++;
                }
              } else {
                const err9 = {
                  instancePath: instancePath + "/type",
                  schemaPath: "#/$defs/implementation-name/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err9];
                } else {
                  vErrors.push(err9);
                }
                errors++;
              }
            }
            var valid3 = _errs9 === errors;
          } else {
            var valid3 = true;
          }
          if (valid3) {
            if (data.params !== undefined) {
              let data1 = data.params;
              const _errs14 = errors;
              if (!(data1 && typeof data1 == "object" && !Array.isArray(data1))) {
                const err10 = {
                  instancePath: instancePath + "/params",
                  schemaPath: "#/oneOf/1/properties/params/type",
                  keyword: "type",
                  params: { type: "object" },
                  message: "must be object",
                };
                if (vErrors === null) {
                  vErrors = [err10];
                } else {
                  vErrors.push(err10);
                }
                errors++;
              }
              var valid3 = _errs14 === errors;
            } else {
              var valid3 = true;
            }
          }
        }
      }
    } else {
      const err11 = {
        instancePath,
        schemaPath: "#/oneOf/1/type",
        keyword: "type",
        params: { type: "object" },
        message: "must be object",
      };
      if (vErrors === null) {
        vErrors = [err11];
      } else {
        vErrors.push(err11);
      }
      errors++;
    }
  }
  var _valid0 = _errs6 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      var props0 = true;
    }
    const _errs16 = errors;
    const _errs17 = errors;
    if (errors === _errs17) {
      if (data && typeof data == "object" && !Array.isArray(data)) {
        let missing1;
        if (
          (data.type === undefined && (missing1 = "type")) ||
          (data.params === undefined && (missing1 = "params"))
        ) {
          const err12 = {
            instancePath,
            schemaPath:
              "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference/required",
            keyword: "required",
            params: { missingProperty: missing1 },
            message: "must have required property '" + missing1 + "'",
          };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        } else {
          const _errs19 = errors;
          for (const key1 in data) {
            if (!(key1 === "type" || key1 === "params")) {
              const err13 = {
                instancePath,
                schemaPath:
                  "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key1 },
                message: "must NOT have additional properties",
              };
              if (vErrors === null) {
                vErrors = [err13];
              } else {
                vErrors.push(err13);
              }
              errors++;
              break;
            }
          }
          if (_errs19 === errors) {
            if (data.type !== undefined) {
              let data2 = data.type;
              const _errs20 = errors;
              if (
                !(
                  data2 === "expression.guard" ||
                  data2 === "expression.match" ||
                  data2 === "expression.assign" ||
                  data2 === "expression.map"
                )
              ) {
                const err14 = {
                  instancePath: instancePath + "/type",
                  schemaPath:
                    "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference/properties/type/enum",
                  keyword: "enum",
                  params: { allowedValues: schema48.properties.type.enum },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err14];
                } else {
                  vErrors.push(err14);
                }
                errors++;
              }
              var valid7 = _errs20 === errors;
            } else {
              var valid7 = true;
            }
            if (valid7) {
              if (data.params !== undefined) {
                let data3 = data.params;
                const _errs21 = errors;
                if (errors === _errs21) {
                  if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
                    let missing2;
                    if (data3.expression === undefined && (missing2 = "expression")) {
                      const err15 = {
                        instancePath: instancePath + "/params",
                        schemaPath:
                          "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference/properties/params/required",
                        keyword: "required",
                        params: { missingProperty: missing2 },
                        message: "must have required property '" + missing2 + "'",
                      };
                      if (vErrors === null) {
                        vErrors = [err15];
                      } else {
                        vErrors.push(err15);
                      }
                      errors++;
                    } else {
                      const _errs23 = errors;
                      for (const key2 in data3) {
                        if (!(key2 === "expression")) {
                          const err16 = {
                            instancePath: instancePath + "/params",
                            schemaPath:
                              "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference/properties/params/additionalProperties",
                            keyword: "additionalProperties",
                            params: { additionalProperty: key2 },
                            message: "must NOT have additional properties",
                          };
                          if (vErrors === null) {
                            vErrors = [err16];
                          } else {
                            vErrors.push(err16);
                          }
                          errors++;
                          break;
                        }
                      }
                      if (_errs23 === errors) {
                        if (data3.expression !== undefined) {
                          let data4 = data3.expression;
                          const _errs24 = errors;
                          if (errors === _errs24) {
                            if (typeof data4 === "string") {
                              if (func1(data4) < 1) {
                                const err17 = {
                                  instancePath: instancePath + "/params/expression",
                                  schemaPath:
                                    "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference/properties/params/properties/expression/minLength",
                                  keyword: "minLength",
                                  params: { limit: 1 },
                                  message: "must NOT have fewer than 1 characters",
                                };
                                if (vErrors === null) {
                                  vErrors = [err17];
                                } else {
                                  vErrors.push(err17);
                                }
                                errors++;
                              }
                            } else {
                              const err18 = {
                                instancePath: instancePath + "/params/expression",
                                schemaPath:
                                  "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference/properties/params/properties/expression/type",
                                keyword: "type",
                                params: { type: "string" },
                                message: "must be string",
                              };
                              if (vErrors === null) {
                                vErrors = [err18];
                              } else {
                                vErrors.push(err18);
                              }
                              errors++;
                            }
                          }
                        }
                      }
                    }
                  } else {
                    const err19 = {
                      instancePath: instancePath + "/params",
                      schemaPath:
                        "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference/properties/params/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    };
                    if (vErrors === null) {
                      vErrors = [err19];
                    } else {
                      vErrors.push(err19);
                    }
                    errors++;
                  }
                }
                var valid7 = _errs21 === errors;
              } else {
                var valid7 = true;
              }
            }
          }
        }
      } else {
        const err20 = {
          instancePath,
          schemaPath:
            "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
    }
    var _valid0 = _errs16 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
        if (props0 !== true) {
          props0 = true;
        }
      }
    }
  }
  if (!valid0) {
    const err21 = {
      instancePath,
      schemaPath: "#/oneOf",
      keyword: "oneOf",
      params: { passingSchemas: passing0 },
      message: "must match exactly one schema in oneOf",
    };
    if (vErrors === null) {
      vErrors = [err21];
    } else {
      vErrors.push(err21);
    }
    errors++;
    validate30.errors = vErrors;
    return false;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate30.errors = vErrors;
  evaluated0.props = props0;
  return errors === 0;
}
validate30.evaluated = { dynamicProps: true, dynamicItems: false };
const schema49 = {
  description: "The built-in guard that is true when every listed state is active.",
  type: "object",
  required: ["type", "params"],
  additionalProperties: false,
  properties: {
    type: { const: "in" },
    params: {
      type: "object",
      required: ["states"],
      additionalProperties: false,
      properties: { states: { type: "array", minItems: 1, items: { $ref: "#/$defs/state-path" } } },
    },
  },
};
const schema50 = {
  description: "A state node's keys from the root, joined with `.`.",
  type: "string",
  pattern: "^[^.#]+(\\.[^.#]+)*$",
};
const pattern8 = new RegExp("^[^.#]+(\\.[^.#]+)*$", "u");
function validate33(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate33.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.type === undefined && (missing0 = "type")) ||
        (data.params === undefined && (missing0 = "params"))
      ) {
        validate33.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "type" || key0 === "params")) {
            validate33.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.type !== undefined) {
            const _errs2 = errors;
            if ("in" !== data.type) {
              validate33.errors = [
                {
                  instancePath: instancePath + "/type",
                  schemaPath: "#/properties/type/const",
                  keyword: "const",
                  params: { allowedValue: "in" },
                  message: "must be equal to constant",
                },
              ];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.params !== undefined) {
              let data1 = data.params;
              const _errs3 = errors;
              if (errors === _errs3) {
                if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                  let missing1;
                  if (data1.states === undefined && (missing1 = "states")) {
                    validate33.errors = [
                      {
                        instancePath: instancePath + "/params",
                        schemaPath: "#/properties/params/required",
                        keyword: "required",
                        params: { missingProperty: missing1 },
                        message: "must have required property '" + missing1 + "'",
                      },
                    ];
                    return false;
                  } else {
                    const _errs5 = errors;
                    for (const key1 in data1) {
                      if (!(key1 === "states")) {
                        validate33.errors = [
                          {
                            instancePath: instancePath + "/params",
                            schemaPath: "#/properties/params/additionalProperties",
                            keyword: "additionalProperties",
                            params: { additionalProperty: key1 },
                            message: "must NOT have additional properties",
                          },
                        ];
                        return false;
                        break;
                      }
                    }
                    if (_errs5 === errors) {
                      if (data1.states !== undefined) {
                        let data2 = data1.states;
                        const _errs6 = errors;
                        if (errors === _errs6) {
                          if (Array.isArray(data2)) {
                            if (data2.length < 1) {
                              validate33.errors = [
                                {
                                  instancePath: instancePath + "/params/states",
                                  schemaPath: "#/properties/params/properties/states/minItems",
                                  keyword: "minItems",
                                  params: { limit: 1 },
                                  message: "must NOT have fewer than 1 items",
                                },
                              ];
                              return false;
                            } else {
                              var valid2 = true;
                              const len0 = data2.length;
                              for (let i0 = 0; i0 < len0; i0++) {
                                let data3 = data2[i0];
                                const _errs8 = errors;
                                const _errs9 = errors;
                                if (errors === _errs9) {
                                  if (typeof data3 === "string") {
                                    if (!pattern8.test(data3)) {
                                      validate33.errors = [
                                        {
                                          instancePath: instancePath + "/params/states/" + i0,
                                          schemaPath: "#/$defs/state-path/pattern",
                                          keyword: "pattern",
                                          params: { pattern: "^[^.#]+(\\.[^.#]+)*$" },
                                          message:
                                            'must match pattern "' + "^[^.#]+(\\.[^.#]+)*$" + '"',
                                        },
                                      ];
                                      return false;
                                    }
                                  } else {
                                    validate33.errors = [
                                      {
                                        instancePath: instancePath + "/params/states/" + i0,
                                        schemaPath: "#/$defs/state-path/type",
                                        keyword: "type",
                                        params: { type: "string" },
                                        message: "must be string",
                                      },
                                    ];
                                    return false;
                                  }
                                }
                                var valid2 = _errs8 === errors;
                                if (!valid2) {
                                  break;
                                }
                              }
                            }
                          } else {
                            validate33.errors = [
                              {
                                instancePath: instancePath + "/params/states",
                                schemaPath: "#/properties/params/properties/states/type",
                                keyword: "type",
                                params: { type: "array" },
                                message: "must be array",
                              },
                            ];
                            return false;
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate33.errors = [
                    {
                      instancePath: instancePath + "/params",
                      schemaPath: "#/properties/params/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs3 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate33.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate33.errors = vErrors;
  return errors === 0;
}
validate33.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate29(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate29.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs0 = errors;
  if (
    !validate30(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })
  ) {
    vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
    errors = vErrors.length;
  } else {
    var props0 = validate30.evaluated.props;
  }
  var valid0 = _errs0 === errors;
  if (valid0) {
    const _errs1 = errors;
    const _errs2 = errors;
    const _errs3 = errors;
    if ("in" !== data) {
      const err0 = {};
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    var valid1 = _errs3 === errors;
    if (valid1) {
      validate29.errors = [
        {
          instancePath,
          schemaPath: "#/allOf/1/not",
          keyword: "not",
          params: {},
          message: "must NOT be valid",
        },
      ];
      return false;
    } else {
      errors = _errs2;
      if (vErrors !== null) {
        if (_errs2) {
          vErrors.length = _errs2;
        } else {
          vErrors = null;
        }
      }
    }
    var valid0 = _errs1 === errors;
    if (valid0) {
      const _errs4 = errors;
      const _errs5 = errors;
      let valid2 = true;
      const _errs6 = errors;
      if (errors === _errs6) {
        if (data && typeof data == "object" && !Array.isArray(data)) {
          let missing0;
          if (data.type === undefined && (missing0 = "type")) {
            const err1 = {};
            if (vErrors === null) {
              vErrors = [err1];
            } else {
              vErrors.push(err1);
            }
            errors++;
          } else {
            if (data.type !== undefined) {
              if ("in" !== data.type) {
                const err2 = {};
                if (vErrors === null) {
                  vErrors = [err2];
                } else {
                  vErrors.push(err2);
                }
                errors++;
              }
            }
          }
        } else {
          const err3 = {};
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
      }
      var _valid0 = _errs6 === errors;
      errors = _errs5;
      if (vErrors !== null) {
        if (_errs5) {
          vErrors.length = _errs5;
        } else {
          vErrors = null;
        }
      }
      if (_valid0) {
        const _errs9 = errors;
        if (
          !validate33(data, {
            instancePath,
            parentData,
            parentDataProperty,
            rootData,
            dynamicAnchors,
          })
        ) {
          vErrors = vErrors === null ? validate33.errors : vErrors.concat(validate33.errors);
          errors = vErrors.length;
        }
        var _valid0 = _errs9 === errors;
        valid2 = _valid0;
        if (valid2) {
          var props1 = true;
        }
      }
      if (!valid2) {
        const err4 = {
          instancePath,
          schemaPath: "#/allOf/2/if",
          keyword: "if",
          params: { failingKeyword: "then" },
          message: 'must match "then" schema',
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
        validate29.errors = vErrors;
        return false;
      }
      var valid0 = _errs4 === errors;
      if (valid0) {
        if (props0 !== true && props1 !== undefined) {
          if (props1 === true) {
            props0 = true;
          } else {
            props0 = props0 || {};
            Object.assign(props0, props1);
          }
        }
      }
    }
  }
  validate29.errors = vErrors;
  evaluated0.props = props0;
  return errors === 0;
}
validate29.evaluated = { dynamicProps: true, dynamicItems: false };
const schema51 = {
  oneOf: [{ $ref: "#/$defs/reference" }, { type: "array", items: { $ref: "#/$defs/reference" } }],
};
function validate36(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate36.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (
    !validate30(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })
  ) {
    vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
    errors = vErrors.length;
  } else {
    var props0 = validate30.evaluated.props;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
  }
  const _errs2 = errors;
  if (errors === _errs2) {
    if (Array.isArray(data)) {
      var valid1 = true;
      const len0 = data.length;
      for (let i0 = 0; i0 < len0; i0++) {
        const _errs4 = errors;
        if (
          !validate30(data[i0], {
            instancePath: instancePath + "/" + i0,
            parentData: data,
            parentDataProperty: i0,
            rootData,
            dynamicAnchors,
          })
        ) {
          vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
          errors = vErrors.length;
        }
        var valid1 = _errs4 === errors;
        if (!valid1) {
          break;
        }
      }
    } else {
      const err0 = {
        instancePath,
        schemaPath: "#/oneOf/1/type",
        keyword: "type",
        params: { type: "array" },
        message: "must be array",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
  }
  var _valid0 = _errs2 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      var items0 = true;
    }
  }
  if (!valid0) {
    const err1 = {
      instancePath,
      schemaPath: "#/oneOf",
      keyword: "oneOf",
      params: { passingSchemas: passing0 },
      message: "must match exactly one schema in oneOf",
    };
    if (vErrors === null) {
      vErrors = [err1];
    } else {
      vErrors.push(err1);
    }
    errors++;
    validate36.errors = vErrors;
    return false;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate36.errors = vErrors;
  evaluated0.props = props0;
  evaluated0.items = items0;
  return errors === 0;
}
validate36.evaluated = { dynamicProps: true, dynamicItems: true };
function validate28(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate28.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (errors === _errs1) {
    if (typeof data === "string") {
      if (func1(data) < 1) {
        const err0 = {
          instancePath,
          schemaPath: "#/oneOf/0/minLength",
          keyword: "minLength",
          params: { limit: 1 },
          message: "must NOT have fewer than 1 characters",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    } else {
      const err1 = {
        instancePath,
        schemaPath: "#/oneOf/0/type",
        keyword: "type",
        params: { type: "string" },
        message: "must be string",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
  }
  const _errs3 = errors;
  if (errors === _errs3) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      const _errs5 = errors;
      for (const key0 in data) {
        if (
          !(
            key0 === "target" ||
            key0 === "guard" ||
            key0 === "actions" ||
            key0 === "reenter" ||
            key0 === "description" ||
            key0 === "meta"
          )
        ) {
          const err2 = {
            instancePath,
            schemaPath: "#/oneOf/1/additionalProperties",
            keyword: "additionalProperties",
            params: { additionalProperty: key0 },
            message: "must NOT have additional properties",
          };
          if (vErrors === null) {
            vErrors = [err2];
          } else {
            vErrors.push(err2);
          }
          errors++;
          break;
        }
      }
      if (_errs5 === errors) {
        if (data.target !== undefined) {
          let data0 = data.target;
          const _errs6 = errors;
          const _errs8 = errors;
          let valid3 = false;
          let passing1 = null;
          const _errs9 = errors;
          if (errors === _errs9) {
            if (typeof data0 === "string") {
              if (func1(data0) < 1) {
                const err3 = {
                  instancePath: instancePath + "/target",
                  schemaPath: "#/$defs/targets/oneOf/0/minLength",
                  keyword: "minLength",
                  params: { limit: 1 },
                  message: "must NOT have fewer than 1 characters",
                };
                if (vErrors === null) {
                  vErrors = [err3];
                } else {
                  vErrors.push(err3);
                }
                errors++;
              }
            } else {
              const err4 = {
                instancePath: instancePath + "/target",
                schemaPath: "#/$defs/targets/oneOf/0/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err4];
              } else {
                vErrors.push(err4);
              }
              errors++;
            }
          }
          var _valid1 = _errs9 === errors;
          if (_valid1) {
            valid3 = true;
            passing1 = 0;
          }
          const _errs11 = errors;
          if (errors === _errs11) {
            if (Array.isArray(data0)) {
              if (data0.length < 1) {
                const err5 = {
                  instancePath: instancePath + "/target",
                  schemaPath: "#/$defs/targets/oneOf/1/minItems",
                  keyword: "minItems",
                  params: { limit: 1 },
                  message: "must NOT have fewer than 1 items",
                };
                if (vErrors === null) {
                  vErrors = [err5];
                } else {
                  vErrors.push(err5);
                }
                errors++;
              } else {
                var valid4 = true;
                const len0 = data0.length;
                for (let i0 = 0; i0 < len0; i0++) {
                  let data1 = data0[i0];
                  const _errs13 = errors;
                  if (errors === _errs13) {
                    if (typeof data1 === "string") {
                      if (func1(data1) < 1) {
                        const err6 = {
                          instancePath: instancePath + "/target/" + i0,
                          schemaPath: "#/$defs/targets/oneOf/1/items/minLength",
                          keyword: "minLength",
                          params: { limit: 1 },
                          message: "must NOT have fewer than 1 characters",
                        };
                        if (vErrors === null) {
                          vErrors = [err6];
                        } else {
                          vErrors.push(err6);
                        }
                        errors++;
                      }
                    } else {
                      const err7 = {
                        instancePath: instancePath + "/target/" + i0,
                        schemaPath: "#/$defs/targets/oneOf/1/items/type",
                        keyword: "type",
                        params: { type: "string" },
                        message: "must be string",
                      };
                      if (vErrors === null) {
                        vErrors = [err7];
                      } else {
                        vErrors.push(err7);
                      }
                      errors++;
                    }
                  }
                  var valid4 = _errs13 === errors;
                  if (!valid4) {
                    break;
                  }
                }
              }
            } else {
              const err8 = {
                instancePath: instancePath + "/target",
                schemaPath: "#/$defs/targets/oneOf/1/type",
                keyword: "type",
                params: { type: "array" },
                message: "must be array",
              };
              if (vErrors === null) {
                vErrors = [err8];
              } else {
                vErrors.push(err8);
              }
              errors++;
            }
          }
          var _valid1 = _errs11 === errors;
          if (_valid1 && valid3) {
            valid3 = false;
            passing1 = [passing1, 1];
          } else {
            if (_valid1) {
              valid3 = true;
              passing1 = 1;
            }
          }
          if (!valid3) {
            const err9 = {
              instancePath: instancePath + "/target",
              schemaPath: "#/$defs/targets/oneOf",
              keyword: "oneOf",
              params: { passingSchemas: passing1 },
              message: "must match exactly one schema in oneOf",
            };
            if (vErrors === null) {
              vErrors = [err9];
            } else {
              vErrors.push(err9);
            }
            errors++;
          } else {
            errors = _errs8;
            if (vErrors !== null) {
              if (_errs8) {
                vErrors.length = _errs8;
              } else {
                vErrors = null;
              }
            }
          }
          var valid1 = _errs6 === errors;
        } else {
          var valid1 = true;
        }
        if (valid1) {
          if (data.guard !== undefined) {
            const _errs15 = errors;
            if (
              !validate29(data.guard, {
                instancePath: instancePath + "/guard",
                parentData: data,
                parentDataProperty: "guard",
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors = vErrors === null ? validate29.errors : vErrors.concat(validate29.errors);
              errors = vErrors.length;
            }
            var valid1 = _errs15 === errors;
          } else {
            var valid1 = true;
          }
          if (valid1) {
            if (data.actions !== undefined) {
              const _errs16 = errors;
              if (
                !validate36(data.actions, {
                  instancePath: instancePath + "/actions",
                  parentData: data,
                  parentDataProperty: "actions",
                  rootData,
                  dynamicAnchors,
                })
              ) {
                vErrors = vErrors === null ? validate36.errors : vErrors.concat(validate36.errors);
                errors = vErrors.length;
              }
              var valid1 = _errs16 === errors;
            } else {
              var valid1 = true;
            }
            if (valid1) {
              if (data.reenter !== undefined) {
                const _errs17 = errors;
                if (typeof data.reenter !== "boolean") {
                  const err10 = {
                    instancePath: instancePath + "/reenter",
                    schemaPath: "#/oneOf/1/properties/reenter/type",
                    keyword: "type",
                    params: { type: "boolean" },
                    message: "must be boolean",
                  };
                  if (vErrors === null) {
                    vErrors = [err10];
                  } else {
                    vErrors.push(err10);
                  }
                  errors++;
                }
                var valid1 = _errs17 === errors;
              } else {
                var valid1 = true;
              }
              if (valid1) {
                if (data.description !== undefined) {
                  const _errs19 = errors;
                  if (typeof data.description !== "string") {
                    const err11 = {
                      instancePath: instancePath + "/description",
                      schemaPath: "#/oneOf/1/properties/description/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err11];
                    } else {
                      vErrors.push(err11);
                    }
                    errors++;
                  }
                  var valid1 = _errs19 === errors;
                } else {
                  var valid1 = true;
                }
                if (valid1) {
                  if (data.meta !== undefined) {
                    let data6 = data.meta;
                    const _errs21 = errors;
                    if (!(data6 && typeof data6 == "object" && !Array.isArray(data6))) {
                      const err12 = {
                        instancePath: instancePath + "/meta",
                        schemaPath: "#/oneOf/1/properties/meta/type",
                        keyword: "type",
                        params: { type: "object" },
                        message: "must be object",
                      };
                      if (vErrors === null) {
                        vErrors = [err12];
                      } else {
                        vErrors.push(err12);
                      }
                      errors++;
                    }
                    var valid1 = _errs21 === errors;
                  } else {
                    var valid1 = true;
                  }
                }
              }
            }
          }
        }
      }
    } else {
      const err13 = {
        instancePath,
        schemaPath: "#/oneOf/1/type",
        keyword: "type",
        params: { type: "object" },
        message: "must be object",
      };
      if (vErrors === null) {
        vErrors = [err13];
      } else {
        vErrors.push(err13);
      }
      errors++;
    }
  }
  var _valid0 = _errs3 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      var props2 = true;
    }
  }
  if (!valid0) {
    const err14 = {
      instancePath,
      schemaPath: "#/oneOf",
      keyword: "oneOf",
      params: { passingSchemas: passing0 },
      message: "must match exactly one schema in oneOf",
    };
    if (vErrors === null) {
      vErrors = [err14];
    } else {
      vErrors.push(err14);
    }
    errors++;
    validate28.errors = vErrors;
    return false;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate28.errors = vErrors;
  evaluated0.props = props2;
  return errors === 0;
}
validate28.evaluated = { dynamicProps: true, dynamicItems: false };
function validate27(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate27.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (
    !validate28(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })
  ) {
    vErrors = vErrors === null ? validate28.errors : vErrors.concat(validate28.errors);
    errors = vErrors.length;
  } else {
    var props0 = validate28.evaluated.props;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
  }
  const _errs2 = errors;
  if (errors === _errs2) {
    if (Array.isArray(data)) {
      var valid1 = true;
      const len0 = data.length;
      for (let i0 = 0; i0 < len0; i0++) {
        const _errs4 = errors;
        if (
          !validate28(data[i0], {
            instancePath: instancePath + "/" + i0,
            parentData: data,
            parentDataProperty: i0,
            rootData,
            dynamicAnchors,
          })
        ) {
          vErrors = vErrors === null ? validate28.errors : vErrors.concat(validate28.errors);
          errors = vErrors.length;
        }
        var valid1 = _errs4 === errors;
        if (!valid1) {
          break;
        }
      }
    } else {
      const err0 = {
        instancePath,
        schemaPath: "#/oneOf/1/type",
        keyword: "type",
        params: { type: "array" },
        message: "must be array",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
  }
  var _valid0 = _errs2 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      var items0 = true;
    }
  }
  if (!valid0) {
    const err1 = {
      instancePath,
      schemaPath: "#/oneOf",
      keyword: "oneOf",
      params: { passingSchemas: passing0 },
      message: "must match exactly one schema in oneOf",
    };
    if (vErrors === null) {
      vErrors = [err1];
    } else {
      vErrors.push(err1);
    }
    errors++;
    validate27.errors = vErrors;
    return false;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate27.errors = vErrors;
  evaluated0.props = props0;
  evaluated0.items = items0;
  return errors === 0;
}
validate27.evaluated = { dynamicProps: true, dynamicItems: true };
const schema52 = {
  type: "object",
  required: ["src"],
  additionalProperties: false,
  properties: {
    src: {
      description:
        "An actor implementation name, or a blueprint path that invokes a child blueprint.",
      anyOf: [{ $ref: "#/$defs/blueprint-path" }, { $ref: "#/$defs/implementation-name" }],
    },
    id: { type: "string", minLength: 1 },
    systemId: { type: "string", minLength: 1 },
    input: {
      description: "Static input, or an `expression.map`.",
      $ref: "#/$defs/value-or-mapping",
    },
    onDone: { $ref: "#/$defs/transitions" },
    onError: { $ref: "#/$defs/transitions" },
    onSnapshot: { $ref: "#/$defs/transitions" },
  },
};
const schema53 = {
  description: "The repository-relative path of a blueprint file.",
  type: "string",
  pattern: "^blueprints/.+\\.ya?ml$",
};
const pattern9 = new RegExp("^blueprints/.+\\.ya?ml$", "u");
const schema55 = {
  description:
    "A static value, or a mapping. An object whose `type` is `expression.map` is a mapping and has the expression reference shape.",
  if: { type: "object", required: ["type"], properties: { type: { const: "expression.map" } } },
  then: {
    $ref: "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference",
  },
};
function validate49(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate49.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs0 = errors;
  let valid0 = true;
  const _errs1 = errors;
  if (errors === _errs1) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.type === undefined && (missing0 = "type")) {
        const err0 = {};
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      } else {
        if (data.type !== undefined) {
          if ("expression.map" !== data.type) {
            const err1 = {};
            if (vErrors === null) {
              vErrors = [err1];
            } else {
              vErrors.push(err1);
            }
            errors++;
          }
        }
      }
    } else {
      const err2 = {};
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
  }
  var _valid0 = _errs1 === errors;
  errors = _errs0;
  if (vErrors !== null) {
    if (_errs0) {
      vErrors.length = _errs0;
    } else {
      vErrors = null;
    }
  }
  if (_valid0) {
    const _errs4 = errors;
    const _errs5 = errors;
    if (errors === _errs5) {
      if (data && typeof data == "object" && !Array.isArray(data)) {
        let missing1;
        if (
          (data.type === undefined && (missing1 = "type")) ||
          (data.params === undefined && (missing1 = "params"))
        ) {
          validate49.errors = [
            {
              instancePath,
              schemaPath:
                "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference/required",
              keyword: "required",
              params: { missingProperty: missing1 },
              message: "must have required property '" + missing1 + "'",
            },
          ];
          return false;
        } else {
          const _errs7 = errors;
          for (const key0 in data) {
            if (!(key0 === "type" || key0 === "params")) {
              validate49.errors = [
                {
                  instancePath,
                  schemaPath:
                    "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key0 },
                  message: "must NOT have additional properties",
                },
              ];
              return false;
              break;
            }
          }
          if (_errs7 === errors) {
            if (data.type !== undefined) {
              let data1 = data.type;
              const _errs8 = errors;
              if (
                !(
                  data1 === "expression.guard" ||
                  data1 === "expression.match" ||
                  data1 === "expression.assign" ||
                  data1 === "expression.map"
                )
              ) {
                validate49.errors = [
                  {
                    instancePath: instancePath + "/type",
                    schemaPath:
                      "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference/properties/type/enum",
                    keyword: "enum",
                    params: { allowedValues: schema48.properties.type.enum },
                    message: "must be equal to one of the allowed values",
                  },
                ];
                return false;
              }
              var valid3 = _errs8 === errors;
            } else {
              var valid3 = true;
            }
            if (valid3) {
              if (data.params !== undefined) {
                let data2 = data.params;
                const _errs9 = errors;
                if (errors === _errs9) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing2;
                    if (data2.expression === undefined && (missing2 = "expression")) {
                      validate49.errors = [
                        {
                          instancePath: instancePath + "/params",
                          schemaPath:
                            "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference/properties/params/required",
                          keyword: "required",
                          params: { missingProperty: missing2 },
                          message: "must have required property '" + missing2 + "'",
                        },
                      ];
                      return false;
                    } else {
                      const _errs11 = errors;
                      for (const key1 in data2) {
                        if (!(key1 === "expression")) {
                          validate49.errors = [
                            {
                              instancePath: instancePath + "/params",
                              schemaPath:
                                "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference/properties/params/additionalProperties",
                              keyword: "additionalProperties",
                              params: { additionalProperty: key1 },
                              message: "must NOT have additional properties",
                            },
                          ];
                          return false;
                          break;
                        }
                      }
                      if (_errs11 === errors) {
                        if (data2.expression !== undefined) {
                          let data3 = data2.expression;
                          const _errs12 = errors;
                          if (errors === _errs12) {
                            if (typeof data3 === "string") {
                              if (func1(data3) < 1) {
                                validate49.errors = [
                                  {
                                    instancePath: instancePath + "/params/expression",
                                    schemaPath:
                                      "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference/properties/params/properties/expression/minLength",
                                    keyword: "minLength",
                                    params: { limit: 1 },
                                    message: "must NOT have fewer than 1 characters",
                                  },
                                ];
                                return false;
                              }
                            } else {
                              validate49.errors = [
                                {
                                  instancePath: instancePath + "/params/expression",
                                  schemaPath:
                                    "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference/properties/params/properties/expression/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                          }
                        }
                      }
                    }
                  } else {
                    validate49.errors = [
                      {
                        instancePath: instancePath + "/params",
                        schemaPath:
                          "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference/properties/params/type",
                        keyword: "type",
                        params: { type: "object" },
                        message: "must be object",
                      },
                    ];
                    return false;
                  }
                }
                var valid3 = _errs9 === errors;
              } else {
                var valid3 = true;
              }
            }
          }
        }
      } else {
        validate49.errors = [
          {
            instancePath,
            schemaPath:
              "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference/type",
            keyword: "type",
            params: { type: "object" },
            message: "must be object",
          },
        ];
        return false;
      }
    }
    var _valid0 = _errs4 === errors;
    valid0 = _valid0;
    if (valid0) {
      var props0 = true;
    }
  }
  if (!valid0) {
    const err3 = {
      instancePath,
      schemaPath: "#/if",
      keyword: "if",
      params: { failingKeyword: "then" },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err3];
    } else {
      vErrors.push(err3);
    }
    errors++;
    validate49.errors = vErrors;
    return false;
  }
  validate49.errors = vErrors;
  evaluated0.props = props0;
  return errors === 0;
}
validate49.evaluated = { dynamicProps: true, dynamicItems: false };
function validate48(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate48.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.src === undefined && (missing0 = "src")) {
        validate48.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (
            !(
              key0 === "src" ||
              key0 === "id" ||
              key0 === "systemId" ||
              key0 === "input" ||
              key0 === "onDone" ||
              key0 === "onError" ||
              key0 === "onSnapshot"
            )
          ) {
            validate48.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.src !== undefined) {
            let data0 = data.src;
            const _errs2 = errors;
            const _errs3 = errors;
            let valid1 = false;
            const _errs4 = errors;
            const _errs5 = errors;
            if (errors === _errs5) {
              if (typeof data0 === "string") {
                if (!pattern9.test(data0)) {
                  const err0 = {
                    instancePath: instancePath + "/src",
                    schemaPath: "#/$defs/blueprint-path/pattern",
                    keyword: "pattern",
                    params: { pattern: "^blueprints/.+\\.ya?ml$" },
                    message: 'must match pattern "' + "^blueprints/.+\\.ya?ml$" + '"',
                  };
                  if (vErrors === null) {
                    vErrors = [err0];
                  } else {
                    vErrors.push(err0);
                  }
                  errors++;
                }
              } else {
                const err1 = {
                  instancePath: instancePath + "/src",
                  schemaPath: "#/$defs/blueprint-path/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err1];
                } else {
                  vErrors.push(err1);
                }
                errors++;
              }
            }
            var _valid0 = _errs4 === errors;
            valid1 = valid1 || _valid0;
            const _errs7 = errors;
            const _errs8 = errors;
            const _errs10 = errors;
            const _errs11 = errors;
            if (typeof data0 === "string") {
              if (!pattern6.test(data0)) {
                const err2 = {};
                if (vErrors === null) {
                  vErrors = [err2];
                } else {
                  vErrors.push(err2);
                }
                errors++;
              }
            }
            var valid4 = _errs11 === errors;
            if (valid4) {
              const err3 = {
                instancePath: instancePath + "/src",
                schemaPath: "#/$defs/implementation-name/not",
                keyword: "not",
                params: {},
                message: "must NOT be valid",
              };
              if (vErrors === null) {
                vErrors = [err3];
              } else {
                vErrors.push(err3);
              }
              errors++;
            } else {
              errors = _errs10;
              if (vErrors !== null) {
                if (_errs10) {
                  vErrors.length = _errs10;
                } else {
                  vErrors = null;
                }
              }
            }
            if (errors === _errs8) {
              if (typeof data0 === "string") {
                if (func1(data0) < 1) {
                  const err4 = {
                    instancePath: instancePath + "/src",
                    schemaPath: "#/$defs/implementation-name/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err4];
                  } else {
                    vErrors.push(err4);
                  }
                  errors++;
                }
              } else {
                const err5 = {
                  instancePath: instancePath + "/src",
                  schemaPath: "#/$defs/implementation-name/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err5];
                } else {
                  vErrors.push(err5);
                }
                errors++;
              }
            }
            var _valid0 = _errs7 === errors;
            valid1 = valid1 || _valid0;
            if (!valid1) {
              const err6 = {
                instancePath: instancePath + "/src",
                schemaPath: "#/properties/src/anyOf",
                keyword: "anyOf",
                params: {},
                message: "must match a schema in anyOf",
              };
              if (vErrors === null) {
                vErrors = [err6];
              } else {
                vErrors.push(err6);
              }
              errors++;
              validate48.errors = vErrors;
              return false;
            } else {
              errors = _errs3;
              if (vErrors !== null) {
                if (_errs3) {
                  vErrors.length = _errs3;
                } else {
                  vErrors = null;
                }
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.id !== undefined) {
              let data1 = data.id;
              const _errs12 = errors;
              if (errors === _errs12) {
                if (typeof data1 === "string") {
                  if (func1(data1) < 1) {
                    validate48.errors = [
                      {
                        instancePath: instancePath + "/id",
                        schemaPath: "#/properties/id/minLength",
                        keyword: "minLength",
                        params: { limit: 1 },
                        message: "must NOT have fewer than 1 characters",
                      },
                    ];
                    return false;
                  }
                } else {
                  validate48.errors = [
                    {
                      instancePath: instancePath + "/id",
                      schemaPath: "#/properties/id/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs12 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.systemId !== undefined) {
                let data2 = data.systemId;
                const _errs14 = errors;
                if (errors === _errs14) {
                  if (typeof data2 === "string") {
                    if (func1(data2) < 1) {
                      validate48.errors = [
                        {
                          instancePath: instancePath + "/systemId",
                          schemaPath: "#/properties/systemId/minLength",
                          keyword: "minLength",
                          params: { limit: 1 },
                          message: "must NOT have fewer than 1 characters",
                        },
                      ];
                      return false;
                    }
                  } else {
                    validate48.errors = [
                      {
                        instancePath: instancePath + "/systemId",
                        schemaPath: "#/properties/systemId/type",
                        keyword: "type",
                        params: { type: "string" },
                        message: "must be string",
                      },
                    ];
                    return false;
                  }
                }
                var valid0 = _errs14 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.input !== undefined) {
                  const _errs16 = errors;
                  if (
                    !validate49(data.input, {
                      instancePath: instancePath + "/input",
                      parentData: data,
                      parentDataProperty: "input",
                      rootData,
                      dynamicAnchors,
                    })
                  ) {
                    vErrors =
                      vErrors === null ? validate49.errors : vErrors.concat(validate49.errors);
                    errors = vErrors.length;
                  }
                  var valid0 = _errs16 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.onDone !== undefined) {
                    const _errs17 = errors;
                    if (
                      !validate27(data.onDone, {
                        instancePath: instancePath + "/onDone",
                        parentData: data,
                        parentDataProperty: "onDone",
                        rootData,
                        dynamicAnchors,
                      })
                    ) {
                      vErrors =
                        vErrors === null ? validate27.errors : vErrors.concat(validate27.errors);
                      errors = vErrors.length;
                    }
                    var valid0 = _errs17 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.onError !== undefined) {
                      const _errs18 = errors;
                      if (
                        !validate27(data.onError, {
                          instancePath: instancePath + "/onError",
                          parentData: data,
                          parentDataProperty: "onError",
                          rootData,
                          dynamicAnchors,
                        })
                      ) {
                        vErrors =
                          vErrors === null ? validate27.errors : vErrors.concat(validate27.errors);
                        errors = vErrors.length;
                      }
                      var valid0 = _errs18 === errors;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.onSnapshot !== undefined) {
                        const _errs19 = errors;
                        if (
                          !validate27(data.onSnapshot, {
                            instancePath: instancePath + "/onSnapshot",
                            parentData: data,
                            parentDataProperty: "onSnapshot",
                            rootData,
                            dynamicAnchors,
                          })
                        ) {
                          vErrors =
                            vErrors === null
                              ? validate27.errors
                              : vErrors.concat(validate27.errors);
                          errors = vErrors.length;
                        }
                        var valid0 = _errs19 === errors;
                      } else {
                        var valid0 = true;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate48.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate48.errors = vErrors;
  return errors === 0;
}
validate48.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
const schema57 = {
  description:
    "The gate a state declares in `meta.gate`: its comparator file, where its token is returned, whether a reservation accompanies the token, the token event's type, and the region the comparator reads as the task's dependency state.",
  type: "object",
  required: ["comparator", "return"],
  additionalProperties: false,
  properties: {
    comparator: {
      description: "The repository-relative path of the comparator's TypeScript file.",
      type: "string",
      pattern: "^[^/].*\\.ts$",
      not: { pattern: "(^|/)\\.{1,2}(/|$)" },
    },
    return: {
      oneOf: [
        { const: "exit" },
        {
          type: "object",
          required: ["state"],
          additionalProperties: false,
          properties: { state: { $ref: "#/$defs/state-path" } },
        },
      ],
    },
    reservation: { type: "boolean", default: false },
    token: {
      description: "The type of the event that delivers the token.",
      type: "string",
      minLength: 1,
      default: "token",
    },
    dependencies: { $ref: "#/$defs/state-path" },
  },
};
const pattern11 = new RegExp("(^|/)\\.{1,2}(/|$)", "u");
const pattern12 = new RegExp("^[^/].*\\.ts$", "u");
function validate56(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate56.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.comparator === undefined && (missing0 = "comparator")) ||
        (data.return === undefined && (missing0 = "return"))
      ) {
        validate56.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (
            !(
              key0 === "comparator" ||
              key0 === "return" ||
              key0 === "reservation" ||
              key0 === "token" ||
              key0 === "dependencies"
            )
          ) {
            validate56.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.comparator !== undefined) {
            let data0 = data.comparator;
            const _errs2 = errors;
            const _errs4 = errors;
            const _errs5 = errors;
            if (typeof data0 === "string") {
              if (!pattern11.test(data0)) {
                const err0 = {};
                if (vErrors === null) {
                  vErrors = [err0];
                } else {
                  vErrors.push(err0);
                }
                errors++;
              }
            }
            var valid1 = _errs5 === errors;
            if (valid1) {
              validate56.errors = [
                {
                  instancePath: instancePath + "/comparator",
                  schemaPath: "#/properties/comparator/not",
                  keyword: "not",
                  params: {},
                  message: "must NOT be valid",
                },
              ];
              return false;
            } else {
              errors = _errs4;
              if (vErrors !== null) {
                if (_errs4) {
                  vErrors.length = _errs4;
                } else {
                  vErrors = null;
                }
              }
            }
            if (errors === _errs2) {
              if (typeof data0 === "string") {
                if (!pattern12.test(data0)) {
                  validate56.errors = [
                    {
                      instancePath: instancePath + "/comparator",
                      schemaPath: "#/properties/comparator/pattern",
                      keyword: "pattern",
                      params: { pattern: "^[^/].*\\.ts$" },
                      message: 'must match pattern "' + "^[^/].*\\.ts$" + '"',
                    },
                  ];
                  return false;
                }
              } else {
                validate56.errors = [
                  {
                    instancePath: instancePath + "/comparator",
                    schemaPath: "#/properties/comparator/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                  },
                ];
                return false;
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.return !== undefined) {
              let data1 = data.return;
              const _errs6 = errors;
              const _errs7 = errors;
              let valid2 = false;
              let passing0 = null;
              const _errs8 = errors;
              if ("exit" !== data1) {
                const err1 = {
                  instancePath: instancePath + "/return",
                  schemaPath: "#/properties/return/oneOf/0/const",
                  keyword: "const",
                  params: { allowedValue: "exit" },
                  message: "must be equal to constant",
                };
                if (vErrors === null) {
                  vErrors = [err1];
                } else {
                  vErrors.push(err1);
                }
                errors++;
              }
              var _valid0 = _errs8 === errors;
              if (_valid0) {
                valid2 = true;
                passing0 = 0;
              }
              const _errs9 = errors;
              if (errors === _errs9) {
                if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                  let missing1;
                  if (data1.state === undefined && (missing1 = "state")) {
                    const err2 = {
                      instancePath: instancePath + "/return",
                      schemaPath: "#/properties/return/oneOf/1/required",
                      keyword: "required",
                      params: { missingProperty: missing1 },
                      message: "must have required property '" + missing1 + "'",
                    };
                    if (vErrors === null) {
                      vErrors = [err2];
                    } else {
                      vErrors.push(err2);
                    }
                    errors++;
                  } else {
                    const _errs11 = errors;
                    for (const key1 in data1) {
                      if (!(key1 === "state")) {
                        const err3 = {
                          instancePath: instancePath + "/return",
                          schemaPath: "#/properties/return/oneOf/1/additionalProperties",
                          keyword: "additionalProperties",
                          params: { additionalProperty: key1 },
                          message: "must NOT have additional properties",
                        };
                        if (vErrors === null) {
                          vErrors = [err3];
                        } else {
                          vErrors.push(err3);
                        }
                        errors++;
                        break;
                      }
                    }
                    if (_errs11 === errors) {
                      if (data1.state !== undefined) {
                        let data2 = data1.state;
                        const _errs13 = errors;
                        if (errors === _errs13) {
                          if (typeof data2 === "string") {
                            if (!pattern8.test(data2)) {
                              const err4 = {
                                instancePath: instancePath + "/return/state",
                                schemaPath: "#/$defs/state-path/pattern",
                                keyword: "pattern",
                                params: { pattern: "^[^.#]+(\\.[^.#]+)*$" },
                                message: 'must match pattern "' + "^[^.#]+(\\.[^.#]+)*$" + '"',
                              };
                              if (vErrors === null) {
                                vErrors = [err4];
                              } else {
                                vErrors.push(err4);
                              }
                              errors++;
                            }
                          } else {
                            const err5 = {
                              instancePath: instancePath + "/return/state",
                              schemaPath: "#/$defs/state-path/type",
                              keyword: "type",
                              params: { type: "string" },
                              message: "must be string",
                            };
                            if (vErrors === null) {
                              vErrors = [err5];
                            } else {
                              vErrors.push(err5);
                            }
                            errors++;
                          }
                        }
                      }
                    }
                  }
                } else {
                  const err6 = {
                    instancePath: instancePath + "/return",
                    schemaPath: "#/properties/return/oneOf/1/type",
                    keyword: "type",
                    params: { type: "object" },
                    message: "must be object",
                  };
                  if (vErrors === null) {
                    vErrors = [err6];
                  } else {
                    vErrors.push(err6);
                  }
                  errors++;
                }
              }
              var _valid0 = _errs9 === errors;
              if (_valid0 && valid2) {
                valid2 = false;
                passing0 = [passing0, 1];
              } else {
                if (_valid0) {
                  valid2 = true;
                  passing0 = 1;
                }
              }
              if (!valid2) {
                const err7 = {
                  instancePath: instancePath + "/return",
                  schemaPath: "#/properties/return/oneOf",
                  keyword: "oneOf",
                  params: { passingSchemas: passing0 },
                  message: "must match exactly one schema in oneOf",
                };
                if (vErrors === null) {
                  vErrors = [err7];
                } else {
                  vErrors.push(err7);
                }
                errors++;
                validate56.errors = vErrors;
                return false;
              } else {
                errors = _errs7;
                if (vErrors !== null) {
                  if (_errs7) {
                    vErrors.length = _errs7;
                  } else {
                    vErrors = null;
                  }
                }
              }
              var valid0 = _errs6 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.reservation !== undefined) {
                const _errs15 = errors;
                if (typeof data.reservation !== "boolean") {
                  validate56.errors = [
                    {
                      instancePath: instancePath + "/reservation",
                      schemaPath: "#/properties/reservation/type",
                      keyword: "type",
                      params: { type: "boolean" },
                      message: "must be boolean",
                    },
                  ];
                  return false;
                }
                var valid0 = _errs15 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.token !== undefined) {
                  let data4 = data.token;
                  const _errs17 = errors;
                  if (errors === _errs17) {
                    if (typeof data4 === "string") {
                      if (func1(data4) < 1) {
                        validate56.errors = [
                          {
                            instancePath: instancePath + "/token",
                            schemaPath: "#/properties/token/minLength",
                            keyword: "minLength",
                            params: { limit: 1 },
                            message: "must NOT have fewer than 1 characters",
                          },
                        ];
                        return false;
                      }
                    } else {
                      validate56.errors = [
                        {
                          instancePath: instancePath + "/token",
                          schemaPath: "#/properties/token/type",
                          keyword: "type",
                          params: { type: "string" },
                          message: "must be string",
                        },
                      ];
                      return false;
                    }
                  }
                  var valid0 = _errs17 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.dependencies !== undefined) {
                    let data5 = data.dependencies;
                    const _errs19 = errors;
                    const _errs20 = errors;
                    if (errors === _errs20) {
                      if (typeof data5 === "string") {
                        if (!pattern8.test(data5)) {
                          validate56.errors = [
                            {
                              instancePath: instancePath + "/dependencies",
                              schemaPath: "#/$defs/state-path/pattern",
                              keyword: "pattern",
                              params: { pattern: "^[^.#]+(\\.[^.#]+)*$" },
                              message: 'must match pattern "' + "^[^.#]+(\\.[^.#]+)*$" + '"',
                            },
                          ];
                          return false;
                        }
                      } else {
                        validate56.errors = [
                          {
                            instancePath: instancePath + "/dependencies",
                            schemaPath: "#/$defs/state-path/type",
                            keyword: "type",
                            params: { type: "string" },
                            message: "must be string",
                          },
                        ];
                        return false;
                      }
                    }
                    var valid0 = _errs19 === errors;
                  } else {
                    var valid0 = true;
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate56.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate56.errors = vErrors;
  return errors === 0;
}
validate56.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate24(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate24.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.id !== undefined) {
        let data0 = data.id;
        const _errs1 = errors;
        if (errors === _errs1) {
          if (typeof data0 === "string") {
            if (func1(data0) < 1) {
              validate24.errors = [
                {
                  instancePath: instancePath + "/id",
                  schemaPath: "#/properties/id/minLength",
                  keyword: "minLength",
                  params: { limit: 1 },
                  message: "must NOT have fewer than 1 characters",
                },
              ];
              return false;
            }
          } else {
            validate24.errors = [
              {
                instancePath: instancePath + "/id",
                schemaPath: "#/properties/id/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              },
            ];
            return false;
          }
        }
        var valid0 = _errs1 === errors;
      } else {
        var valid0 = true;
      }
      if (valid0) {
        if (data.description !== undefined) {
          const _errs3 = errors;
          if (typeof data.description !== "string") {
            validate24.errors = [
              {
                instancePath: instancePath + "/description",
                schemaPath: "#/properties/description/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              },
            ];
            return false;
          }
          var valid0 = _errs3 === errors;
        } else {
          var valid0 = true;
        }
        if (valid0) {
          if (data.type !== undefined) {
            let data2 = data.type;
            const _errs5 = errors;
            if (
              !(
                data2 === "atomic" ||
                data2 === "compound" ||
                data2 === "parallel" ||
                data2 === "final" ||
                data2 === "history"
              )
            ) {
              validate24.errors = [
                {
                  instancePath: instancePath + "/type",
                  schemaPath: "#/properties/type/enum",
                  keyword: "enum",
                  params: { allowedValues: schema35.properties.type.enum },
                  message: "must be equal to one of the allowed values",
                },
              ];
              return false;
            }
            var valid0 = _errs5 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.initial !== undefined) {
              let data3 = data.initial;
              const _errs6 = errors;
              const _errs7 = errors;
              if (errors === _errs7) {
                if (typeof data3 === "string") {
                  if (func1(data3) < 1) {
                    validate24.errors = [
                      {
                        instancePath: instancePath + "/initial",
                        schemaPath: "#/$defs/state-key/minLength",
                        keyword: "minLength",
                        params: { limit: 1 },
                        message: "must NOT have fewer than 1 characters",
                      },
                    ];
                    return false;
                  } else {
                    if (!pattern4.test(data3)) {
                      validate24.errors = [
                        {
                          instancePath: instancePath + "/initial",
                          schemaPath: "#/$defs/state-key/pattern",
                          keyword: "pattern",
                          params: { pattern: "^[^.#]+$" },
                          message: 'must match pattern "' + "^[^.#]+$" + '"',
                        },
                      ];
                      return false;
                    }
                  }
                } else {
                  validate24.errors = [
                    {
                      instancePath: instancePath + "/initial",
                      schemaPath: "#/$defs/state-key/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs6 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.history !== undefined) {
                let data4 = data.history;
                const _errs9 = errors;
                if (!(data4 === "shallow" || data4 === "deep")) {
                  validate24.errors = [
                    {
                      instancePath: instancePath + "/history",
                      schemaPath: "#/properties/history/enum",
                      keyword: "enum",
                      params: { allowedValues: schema35.properties.history.enum },
                      message: "must be equal to one of the allowed values",
                    },
                  ];
                  return false;
                }
                var valid0 = _errs9 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.target !== undefined) {
                  let data5 = data.target;
                  const _errs10 = errors;
                  const _errs12 = errors;
                  let valid3 = false;
                  let passing0 = null;
                  const _errs13 = errors;
                  if (errors === _errs13) {
                    if (typeof data5 === "string") {
                      if (func1(data5) < 1) {
                        const err0 = {
                          instancePath: instancePath + "/target",
                          schemaPath: "#/$defs/targets/oneOf/0/minLength",
                          keyword: "minLength",
                          params: { limit: 1 },
                          message: "must NOT have fewer than 1 characters",
                        };
                        if (vErrors === null) {
                          vErrors = [err0];
                        } else {
                          vErrors.push(err0);
                        }
                        errors++;
                      }
                    } else {
                      const err1 = {
                        instancePath: instancePath + "/target",
                        schemaPath: "#/$defs/targets/oneOf/0/type",
                        keyword: "type",
                        params: { type: "string" },
                        message: "must be string",
                      };
                      if (vErrors === null) {
                        vErrors = [err1];
                      } else {
                        vErrors.push(err1);
                      }
                      errors++;
                    }
                  }
                  var _valid0 = _errs13 === errors;
                  if (_valid0) {
                    valid3 = true;
                    passing0 = 0;
                  }
                  const _errs15 = errors;
                  if (errors === _errs15) {
                    if (Array.isArray(data5)) {
                      if (data5.length < 1) {
                        const err2 = {
                          instancePath: instancePath + "/target",
                          schemaPath: "#/$defs/targets/oneOf/1/minItems",
                          keyword: "minItems",
                          params: { limit: 1 },
                          message: "must NOT have fewer than 1 items",
                        };
                        if (vErrors === null) {
                          vErrors = [err2];
                        } else {
                          vErrors.push(err2);
                        }
                        errors++;
                      } else {
                        var valid4 = true;
                        const len0 = data5.length;
                        for (let i0 = 0; i0 < len0; i0++) {
                          let data6 = data5[i0];
                          const _errs17 = errors;
                          if (errors === _errs17) {
                            if (typeof data6 === "string") {
                              if (func1(data6) < 1) {
                                const err3 = {
                                  instancePath: instancePath + "/target/" + i0,
                                  schemaPath: "#/$defs/targets/oneOf/1/items/minLength",
                                  keyword: "minLength",
                                  params: { limit: 1 },
                                  message: "must NOT have fewer than 1 characters",
                                };
                                if (vErrors === null) {
                                  vErrors = [err3];
                                } else {
                                  vErrors.push(err3);
                                }
                                errors++;
                              }
                            } else {
                              const err4 = {
                                instancePath: instancePath + "/target/" + i0,
                                schemaPath: "#/$defs/targets/oneOf/1/items/type",
                                keyword: "type",
                                params: { type: "string" },
                                message: "must be string",
                              };
                              if (vErrors === null) {
                                vErrors = [err4];
                              } else {
                                vErrors.push(err4);
                              }
                              errors++;
                            }
                          }
                          var valid4 = _errs17 === errors;
                          if (!valid4) {
                            break;
                          }
                        }
                      }
                    } else {
                      const err5 = {
                        instancePath: instancePath + "/target",
                        schemaPath: "#/$defs/targets/oneOf/1/type",
                        keyword: "type",
                        params: { type: "array" },
                        message: "must be array",
                      };
                      if (vErrors === null) {
                        vErrors = [err5];
                      } else {
                        vErrors.push(err5);
                      }
                      errors++;
                    }
                  }
                  var _valid0 = _errs15 === errors;
                  if (_valid0 && valid3) {
                    valid3 = false;
                    passing0 = [passing0, 1];
                  } else {
                    if (_valid0) {
                      valid3 = true;
                      passing0 = 1;
                    }
                  }
                  if (!valid3) {
                    const err6 = {
                      instancePath: instancePath + "/target",
                      schemaPath: "#/$defs/targets/oneOf",
                      keyword: "oneOf",
                      params: { passingSchemas: passing0 },
                      message: "must match exactly one schema in oneOf",
                    };
                    if (vErrors === null) {
                      vErrors = [err6];
                    } else {
                      vErrors.push(err6);
                    }
                    errors++;
                    validate24.errors = vErrors;
                    return false;
                  } else {
                    errors = _errs12;
                    if (vErrors !== null) {
                      if (_errs12) {
                        vErrors.length = _errs12;
                      } else {
                        vErrors = null;
                      }
                    }
                  }
                  var valid0 = _errs10 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.states !== undefined) {
                    let data7 = data.states;
                    const _errs19 = errors;
                    if (errors === _errs19) {
                      if (data7 && typeof data7 == "object" && !Array.isArray(data7)) {
                        for (const key0 in data7) {
                          const _errs21 = errors;
                          const _errs22 = errors;
                          if (errors === _errs22) {
                            if (typeof key0 === "string") {
                              if (func1(key0) < 1) {
                                const err7 = {
                                  instancePath: instancePath + "/states",
                                  schemaPath: "#/$defs/state-key/minLength",
                                  keyword: "minLength",
                                  params: { limit: 1 },
                                  message: "must NOT have fewer than 1 characters",
                                  propertyName: key0,
                                };
                                if (vErrors === null) {
                                  vErrors = [err7];
                                } else {
                                  vErrors.push(err7);
                                }
                                errors++;
                              } else {
                                if (!pattern4.test(key0)) {
                                  const err8 = {
                                    instancePath: instancePath + "/states",
                                    schemaPath: "#/$defs/state-key/pattern",
                                    keyword: "pattern",
                                    params: { pattern: "^[^.#]+$" },
                                    message: 'must match pattern "' + "^[^.#]+$" + '"',
                                    propertyName: key0,
                                  };
                                  if (vErrors === null) {
                                    vErrors = [err8];
                                  } else {
                                    vErrors.push(err8);
                                  }
                                  errors++;
                                }
                              }
                            } else {
                              const err9 = {
                                instancePath: instancePath + "/states",
                                schemaPath: "#/$defs/state-key/type",
                                keyword: "type",
                                params: { type: "string" },
                                message: "must be string",
                                propertyName: key0,
                              };
                              if (vErrors === null) {
                                vErrors = [err9];
                              } else {
                                vErrors.push(err9);
                              }
                              errors++;
                            }
                          }
                          var valid5 = _errs21 === errors;
                          if (!valid5) {
                            const err10 = {
                              instancePath: instancePath + "/states",
                              schemaPath: "#/properties/states/propertyNames",
                              keyword: "propertyNames",
                              params: { propertyName: key0 },
                              message: "property name must be valid",
                            };
                            if (vErrors === null) {
                              vErrors = [err10];
                            } else {
                              vErrors.push(err10);
                            }
                            errors++;
                            validate24.errors = vErrors;
                            return false;
                            break;
                          }
                        }
                        if (valid5) {
                          for (const key1 in data7) {
                            const _errs25 = errors;
                            if (
                              !validate25(data7[key1], {
                                instancePath:
                                  instancePath +
                                  "/states/" +
                                  key1.replace(/~/g, "~0").replace(/\//g, "~1"),
                                parentData: data7,
                                parentDataProperty: key1,
                                rootData,
                                dynamicAnchors,
                              })
                            ) {
                              vErrors =
                                vErrors === null
                                  ? validate25.errors
                                  : vErrors.concat(validate25.errors);
                              errors = vErrors.length;
                            }
                            var valid7 = _errs25 === errors;
                            if (!valid7) {
                              break;
                            }
                          }
                        }
                      } else {
                        validate24.errors = [
                          {
                            instancePath: instancePath + "/states",
                            schemaPath: "#/properties/states/type",
                            keyword: "type",
                            params: { type: "object" },
                            message: "must be object",
                          },
                        ];
                        return false;
                      }
                    }
                    var valid0 = _errs19 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.on !== undefined) {
                      let data9 = data.on;
                      const _errs26 = errors;
                      if (errors === _errs26) {
                        if (data9 && typeof data9 == "object" && !Array.isArray(data9)) {
                          for (const key2 in data9) {
                            const _errs29 = errors;
                            if (
                              !validate27(data9[key2], {
                                instancePath:
                                  instancePath +
                                  "/on/" +
                                  key2.replace(/~/g, "~0").replace(/\//g, "~1"),
                                parentData: data9,
                                parentDataProperty: key2,
                                rootData,
                                dynamicAnchors,
                              })
                            ) {
                              vErrors =
                                vErrors === null
                                  ? validate27.errors
                                  : vErrors.concat(validate27.errors);
                              errors = vErrors.length;
                            }
                            var valid8 = _errs29 === errors;
                            if (!valid8) {
                              break;
                            }
                          }
                        } else {
                          validate24.errors = [
                            {
                              instancePath: instancePath + "/on",
                              schemaPath: "#/properties/on/type",
                              keyword: "type",
                              params: { type: "object" },
                              message: "must be object",
                            },
                          ];
                          return false;
                        }
                      }
                      var valid0 = _errs26 === errors;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.always !== undefined) {
                        const _errs30 = errors;
                        if (
                          !validate27(data.always, {
                            instancePath: instancePath + "/always",
                            parentData: data,
                            parentDataProperty: "always",
                            rootData,
                            dynamicAnchors,
                          })
                        ) {
                          vErrors =
                            vErrors === null
                              ? validate27.errors
                              : vErrors.concat(validate27.errors);
                          errors = vErrors.length;
                        }
                        var valid0 = _errs30 === errors;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.after !== undefined) {
                          let data12 = data.after;
                          const _errs31 = errors;
                          if (errors === _errs31) {
                            if (data12 && typeof data12 == "object" && !Array.isArray(data12)) {
                              for (const key3 in data12) {
                                const _errs33 = errors;
                                if (typeof key3 === "string") {
                                  if (func1(key3) < 1) {
                                    const err11 = {
                                      instancePath: instancePath + "/after",
                                      schemaPath: "#/properties/after/propertyNames/minLength",
                                      keyword: "minLength",
                                      params: { limit: 1 },
                                      message: "must NOT have fewer than 1 characters",
                                      propertyName: key3,
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err11];
                                    } else {
                                      vErrors.push(err11);
                                    }
                                    errors++;
                                  }
                                }
                                var valid9 = _errs33 === errors;
                                if (!valid9) {
                                  const err12 = {
                                    instancePath: instancePath + "/after",
                                    schemaPath: "#/properties/after/propertyNames",
                                    keyword: "propertyNames",
                                    params: { propertyName: key3 },
                                    message: "property name must be valid",
                                  };
                                  if (vErrors === null) {
                                    vErrors = [err12];
                                  } else {
                                    vErrors.push(err12);
                                  }
                                  errors++;
                                  validate24.errors = vErrors;
                                  return false;
                                  break;
                                }
                              }
                              if (valid9) {
                                for (const key4 in data12) {
                                  const _errs35 = errors;
                                  if (
                                    !validate27(data12[key4], {
                                      instancePath:
                                        instancePath +
                                        "/after/" +
                                        key4.replace(/~/g, "~0").replace(/\//g, "~1"),
                                      parentData: data12,
                                      parentDataProperty: key4,
                                      rootData,
                                      dynamicAnchors,
                                    })
                                  ) {
                                    vErrors =
                                      vErrors === null
                                        ? validate27.errors
                                        : vErrors.concat(validate27.errors);
                                    errors = vErrors.length;
                                  }
                                  var valid10 = _errs35 === errors;
                                  if (!valid10) {
                                    break;
                                  }
                                }
                              }
                            } else {
                              validate24.errors = [
                                {
                                  instancePath: instancePath + "/after",
                                  schemaPath: "#/properties/after/type",
                                  keyword: "type",
                                  params: { type: "object" },
                                  message: "must be object",
                                },
                              ];
                              return false;
                            }
                          }
                          var valid0 = _errs31 === errors;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.onDone !== undefined) {
                            const _errs36 = errors;
                            if (
                              !validate27(data.onDone, {
                                instancePath: instancePath + "/onDone",
                                parentData: data,
                                parentDataProperty: "onDone",
                                rootData,
                                dynamicAnchors,
                              })
                            ) {
                              vErrors =
                                vErrors === null
                                  ? validate27.errors
                                  : vErrors.concat(validate27.errors);
                              errors = vErrors.length;
                            }
                            var valid0 = _errs36 === errors;
                          } else {
                            var valid0 = true;
                          }
                          if (valid0) {
                            if (data.entry !== undefined) {
                              const _errs37 = errors;
                              if (
                                !validate36(data.entry, {
                                  instancePath: instancePath + "/entry",
                                  parentData: data,
                                  parentDataProperty: "entry",
                                  rootData,
                                  dynamicAnchors,
                                })
                              ) {
                                vErrors =
                                  vErrors === null
                                    ? validate36.errors
                                    : vErrors.concat(validate36.errors);
                                errors = vErrors.length;
                              }
                              var valid0 = _errs37 === errors;
                            } else {
                              var valid0 = true;
                            }
                            if (valid0) {
                              if (data.exit !== undefined) {
                                const _errs38 = errors;
                                if (
                                  !validate36(data.exit, {
                                    instancePath: instancePath + "/exit",
                                    parentData: data,
                                    parentDataProperty: "exit",
                                    rootData,
                                    dynamicAnchors,
                                  })
                                ) {
                                  vErrors =
                                    vErrors === null
                                      ? validate36.errors
                                      : vErrors.concat(validate36.errors);
                                  errors = vErrors.length;
                                }
                                var valid0 = _errs38 === errors;
                              } else {
                                var valid0 = true;
                              }
                              if (valid0) {
                                if (data.invoke !== undefined) {
                                  let data17 = data.invoke;
                                  const _errs39 = errors;
                                  const _errs40 = errors;
                                  let valid11 = false;
                                  let passing1 = null;
                                  const _errs41 = errors;
                                  if (
                                    !validate48(data17, {
                                      instancePath: instancePath + "/invoke",
                                      parentData: data,
                                      parentDataProperty: "invoke",
                                      rootData,
                                      dynamicAnchors,
                                    })
                                  ) {
                                    vErrors =
                                      vErrors === null
                                        ? validate48.errors
                                        : vErrors.concat(validate48.errors);
                                    errors = vErrors.length;
                                  }
                                  var _valid1 = _errs41 === errors;
                                  if (_valid1) {
                                    valid11 = true;
                                    passing1 = 0;
                                  }
                                  const _errs42 = errors;
                                  if (errors === _errs42) {
                                    if (Array.isArray(data17)) {
                                      var valid12 = true;
                                      const len1 = data17.length;
                                      for (let i1 = 0; i1 < len1; i1++) {
                                        const _errs44 = errors;
                                        if (
                                          !validate48(data17[i1], {
                                            instancePath: instancePath + "/invoke/" + i1,
                                            parentData: data17,
                                            parentDataProperty: i1,
                                            rootData,
                                            dynamicAnchors,
                                          })
                                        ) {
                                          vErrors =
                                            vErrors === null
                                              ? validate48.errors
                                              : vErrors.concat(validate48.errors);
                                          errors = vErrors.length;
                                        }
                                        var valid12 = _errs44 === errors;
                                        if (!valid12) {
                                          break;
                                        }
                                      }
                                    } else {
                                      const err13 = {
                                        instancePath: instancePath + "/invoke",
                                        schemaPath: "#/properties/invoke/oneOf/1/type",
                                        keyword: "type",
                                        params: { type: "array" },
                                        message: "must be array",
                                      };
                                      if (vErrors === null) {
                                        vErrors = [err13];
                                      } else {
                                        vErrors.push(err13);
                                      }
                                      errors++;
                                    }
                                  }
                                  var _valid1 = _errs42 === errors;
                                  if (_valid1 && valid11) {
                                    valid11 = false;
                                    passing1 = [passing1, 1];
                                  } else {
                                    if (_valid1) {
                                      valid11 = true;
                                      passing1 = 1;
                                    }
                                  }
                                  if (!valid11) {
                                    const err14 = {
                                      instancePath: instancePath + "/invoke",
                                      schemaPath: "#/properties/invoke/oneOf",
                                      keyword: "oneOf",
                                      params: { passingSchemas: passing1 },
                                      message: "must match exactly one schema in oneOf",
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err14];
                                    } else {
                                      vErrors.push(err14);
                                    }
                                    errors++;
                                    validate24.errors = vErrors;
                                    return false;
                                  } else {
                                    errors = _errs40;
                                    if (vErrors !== null) {
                                      if (_errs40) {
                                        vErrors.length = _errs40;
                                      } else {
                                        vErrors = null;
                                      }
                                    }
                                  }
                                  var valid0 = _errs39 === errors;
                                } else {
                                  var valid0 = true;
                                }
                                if (valid0) {
                                  if (data.meta !== undefined) {
                                    let data19 = data.meta;
                                    const _errs45 = errors;
                                    if (errors === _errs45) {
                                      if (
                                        data19 &&
                                        typeof data19 == "object" &&
                                        !Array.isArray(data19)
                                      ) {
                                        if (data19.gate !== undefined) {
                                          if (
                                            !validate56(data19.gate, {
                                              instancePath: instancePath + "/meta/gate",
                                              parentData: data19,
                                              parentDataProperty: "gate",
                                              rootData,
                                              dynamicAnchors,
                                            })
                                          ) {
                                            vErrors =
                                              vErrors === null
                                                ? validate56.errors
                                                : vErrors.concat(validate56.errors);
                                            errors = vErrors.length;
                                          }
                                        }
                                      } else {
                                        validate24.errors = [
                                          {
                                            instancePath: instancePath + "/meta",
                                            schemaPath: "#/properties/meta/type",
                                            keyword: "type",
                                            params: { type: "object" },
                                            message: "must be object",
                                          },
                                        ];
                                        return false;
                                      }
                                    }
                                    var valid0 = _errs45 === errors;
                                  } else {
                                    var valid0 = true;
                                  }
                                  if (valid0) {
                                    if (data.tags !== undefined) {
                                      let data21 = data.tags;
                                      const _errs48 = errors;
                                      const _errs49 = errors;
                                      let valid14 = false;
                                      let passing2 = null;
                                      const _errs50 = errors;
                                      if (typeof data21 !== "string") {
                                        const err15 = {
                                          instancePath: instancePath + "/tags",
                                          schemaPath: "#/properties/tags/oneOf/0/type",
                                          keyword: "type",
                                          params: { type: "string" },
                                          message: "must be string",
                                        };
                                        if (vErrors === null) {
                                          vErrors = [err15];
                                        } else {
                                          vErrors.push(err15);
                                        }
                                        errors++;
                                      }
                                      var _valid2 = _errs50 === errors;
                                      if (_valid2) {
                                        valid14 = true;
                                        passing2 = 0;
                                      }
                                      const _errs52 = errors;
                                      if (errors === _errs52) {
                                        if (Array.isArray(data21)) {
                                          var valid15 = true;
                                          const len2 = data21.length;
                                          for (let i2 = 0; i2 < len2; i2++) {
                                            const _errs54 = errors;
                                            if (typeof data21[i2] !== "string") {
                                              const err16 = {
                                                instancePath: instancePath + "/tags/" + i2,
                                                schemaPath: "#/properties/tags/oneOf/1/items/type",
                                                keyword: "type",
                                                params: { type: "string" },
                                                message: "must be string",
                                              };
                                              if (vErrors === null) {
                                                vErrors = [err16];
                                              } else {
                                                vErrors.push(err16);
                                              }
                                              errors++;
                                            }
                                            var valid15 = _errs54 === errors;
                                            if (!valid15) {
                                              break;
                                            }
                                          }
                                        } else {
                                          const err17 = {
                                            instancePath: instancePath + "/tags",
                                            schemaPath: "#/properties/tags/oneOf/1/type",
                                            keyword: "type",
                                            params: { type: "array" },
                                            message: "must be array",
                                          };
                                          if (vErrors === null) {
                                            vErrors = [err17];
                                          } else {
                                            vErrors.push(err17);
                                          }
                                          errors++;
                                        }
                                      }
                                      var _valid2 = _errs52 === errors;
                                      if (_valid2 && valid14) {
                                        valid14 = false;
                                        passing2 = [passing2, 1];
                                      } else {
                                        if (_valid2) {
                                          valid14 = true;
                                          passing2 = 1;
                                        }
                                      }
                                      if (!valid14) {
                                        const err18 = {
                                          instancePath: instancePath + "/tags",
                                          schemaPath: "#/properties/tags/oneOf",
                                          keyword: "oneOf",
                                          params: { passingSchemas: passing2 },
                                          message: "must match exactly one schema in oneOf",
                                        };
                                        if (vErrors === null) {
                                          vErrors = [err18];
                                        } else {
                                          vErrors.push(err18);
                                        }
                                        errors++;
                                        validate24.errors = vErrors;
                                        return false;
                                      } else {
                                        errors = _errs49;
                                        if (vErrors !== null) {
                                          if (_errs49) {
                                            vErrors.length = _errs49;
                                          } else {
                                            vErrors = null;
                                          }
                                        }
                                      }
                                      var valid0 = _errs48 === errors;
                                    } else {
                                      var valid0 = true;
                                    }
                                    if (valid0) {
                                      if (data.output !== undefined) {
                                        const _errs56 = errors;
                                        if (
                                          !validate49(data.output, {
                                            instancePath: instancePath + "/output",
                                            parentData: data,
                                            parentDataProperty: "output",
                                            rootData,
                                            dynamicAnchors,
                                          })
                                        ) {
                                          vErrors =
                                            vErrors === null
                                              ? validate49.errors
                                              : vErrors.concat(validate49.errors);
                                          errors = vErrors.length;
                                        }
                                        var valid0 = _errs56 === errors;
                                      } else {
                                        var valid0 = true;
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate24.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate24.errors = vErrors;
  return errors === 0;
}
validate24.evaluated = {
  props: {
    id: true,
    description: true,
    type: true,
    initial: true,
    history: true,
    target: true,
    states: true,
    on: true,
    always: true,
    after: true,
    onDone: true,
    entry: true,
    exit: true,
    invoke: true,
    meta: true,
    tags: true,
    output: true,
  },
  dynamicProps: false,
  dynamicItems: false,
};
function validate23(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate23.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (
    !validate24(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })
  ) {
    vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
    errors = vErrors.length;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      for (const key0 in data) {
        const _errs2 = errors;
        if (
          !(
            key0 === "description" ||
            key0 === "type" ||
            key0 === "initial" ||
            key0 === "history" ||
            key0 === "target" ||
            key0 === "states" ||
            key0 === "on" ||
            key0 === "always" ||
            key0 === "after" ||
            key0 === "onDone" ||
            key0 === "entry" ||
            key0 === "exit" ||
            key0 === "invoke" ||
            key0 === "meta" ||
            key0 === "tags" ||
            key0 === "output" ||
            key0 === "id" ||
            key0 === "context"
          )
        ) {
          const err0 = {
            instancePath,
            schemaPath: "#/propertyNames/enum",
            keyword: "enum",
            params: { allowedValues: schema34.propertyNames.enum },
            message: "must be equal to one of the allowed values",
            propertyName: key0,
          };
          if (vErrors === null) {
            vErrors = [err0];
          } else {
            vErrors.push(err0);
          }
          errors++;
        }
        var valid1 = _errs2 === errors;
        if (!valid1) {
          const err1 = {
            instancePath,
            schemaPath: "#/propertyNames",
            keyword: "propertyNames",
            params: { propertyName: key0 },
            message: "property name must be valid",
          };
          if (vErrors === null) {
            vErrors = [err1];
          } else {
            vErrors.push(err1);
          }
          errors++;
          validate23.errors = vErrors;
          return false;
          break;
        }
      }
      if (valid1) {
        if (data.context !== undefined) {
          let data0 = data.context;
          if (!(data0 && typeof data0 == "object" && !Array.isArray(data0))) {
            validate23.errors = [
              {
                instancePath: instancePath + "/context",
                schemaPath: "#/properties/context/type",
                keyword: "type",
                params: { type: "object" },
                message: "must be object",
              },
            ];
            return false;
          }
          const _errs5 = errors;
          const _errs6 = errors;
          if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
            let missing0;
            if (data0.manifold === undefined && (missing0 = "manifold")) {
              const err2 = {};
              if (vErrors === null) {
                vErrors = [err2];
              } else {
                vErrors.push(err2);
              }
              errors++;
            }
          }
          var valid3 = _errs6 === errors;
          if (valid3) {
            validate23.errors = [
              {
                instancePath: instancePath + "/context",
                schemaPath: "#/properties/context/not",
                keyword: "not",
                params: {},
                message: "must NOT be valid",
              },
            ];
            return false;
          } else {
            errors = _errs5;
            if (vErrors !== null) {
              if (_errs5) {
                vErrors.length = _errs5;
              } else {
                vErrors = null;
              }
            }
          }
        }
      }
    } else {
      validate23.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate23.errors = vErrors;
  return errors === 0;
}
validate23.evaluated = {
  props: {
    context: true,
    id: true,
    description: true,
    type: true,
    initial: true,
    history: true,
    target: true,
    states: true,
    on: true,
    always: true,
    after: true,
    onDone: true,
    entry: true,
    exit: true,
    invoke: true,
    meta: true,
    tags: true,
    output: true,
  },
  dynamicProps: false,
  dynamicItems: false,
};
const schema60 = {
  description:
    "The JSON Schemas that bound a blueprint's expressions. Each value is a JSON Schema of draft 2020-12.",
  type: "object",
  required: ["input", "output", "context", "events"],
  additionalProperties: false,
  properties: {
    input: { $ref: "#/$defs/json-schema" },
    output: { $ref: "#/$defs/json-schema" },
    context: { $ref: "#/$defs/json-schema" },
    events: {
      description:
        "One schema per accepted event type, keyed by type, describing the whole event object including `type`.",
      type: "object",
      additionalProperties: { $ref: "#/$defs/json-schema" },
    },
    actors: {
      description: "The input and output schema of each invoked `src`, keyed by `src`.",
      type: "object",
      additionalProperties: {
        type: "object",
        required: ["input", "output"],
        additionalProperties: false,
        properties: {
          input: { $ref: "#/$defs/json-schema" },
          output: { $ref: "#/$defs/json-schema" },
        },
      },
    },
  },
};
const schema61 = { description: "A JSON Schema of draft 2020-12.", type: ["object", "boolean"] };
function validate61(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate61.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.input === undefined && (missing0 = "input")) ||
        (data.output === undefined && (missing0 = "output")) ||
        (data.context === undefined && (missing0 = "context")) ||
        (data.events === undefined && (missing0 = "events"))
      ) {
        validate61.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (
            !(
              key0 === "input" ||
              key0 === "output" ||
              key0 === "context" ||
              key0 === "events" ||
              key0 === "actors"
            )
          ) {
            validate61.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.input !== undefined) {
            let data0 = data.input;
            const _errs2 = errors;
            if (
              !(data0 && typeof data0 == "object" && !Array.isArray(data0)) &&
              typeof data0 !== "boolean"
            ) {
              validate61.errors = [
                {
                  instancePath: instancePath + "/input",
                  schemaPath: "#/$defs/json-schema/type",
                  keyword: "type",
                  params: { type: schema61.type },
                  message: "must be object,boolean",
                },
              ];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.output !== undefined) {
              let data1 = data.output;
              const _errs5 = errors;
              if (
                !(data1 && typeof data1 == "object" && !Array.isArray(data1)) &&
                typeof data1 !== "boolean"
              ) {
                validate61.errors = [
                  {
                    instancePath: instancePath + "/output",
                    schemaPath: "#/$defs/json-schema/type",
                    keyword: "type",
                    params: { type: schema61.type },
                    message: "must be object,boolean",
                  },
                ];
                return false;
              }
              var valid0 = _errs5 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.context !== undefined) {
                let data2 = data.context;
                const _errs8 = errors;
                if (
                  !(data2 && typeof data2 == "object" && !Array.isArray(data2)) &&
                  typeof data2 !== "boolean"
                ) {
                  validate61.errors = [
                    {
                      instancePath: instancePath + "/context",
                      schemaPath: "#/$defs/json-schema/type",
                      keyword: "type",
                      params: { type: schema61.type },
                      message: "must be object,boolean",
                    },
                  ];
                  return false;
                }
                var valid0 = _errs8 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.events !== undefined) {
                  let data3 = data.events;
                  const _errs11 = errors;
                  if (errors === _errs11) {
                    if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
                      for (const key1 in data3) {
                        let data4 = data3[key1];
                        const _errs14 = errors;
                        if (
                          !(data4 && typeof data4 == "object" && !Array.isArray(data4)) &&
                          typeof data4 !== "boolean"
                        ) {
                          validate61.errors = [
                            {
                              instancePath:
                                instancePath +
                                "/events/" +
                                key1.replace(/~/g, "~0").replace(/\//g, "~1"),
                              schemaPath: "#/$defs/json-schema/type",
                              keyword: "type",
                              params: { type: schema61.type },
                              message: "must be object,boolean",
                            },
                          ];
                          return false;
                        }
                        var valid4 = _errs14 === errors;
                        if (!valid4) {
                          break;
                        }
                      }
                    } else {
                      validate61.errors = [
                        {
                          instancePath: instancePath + "/events",
                          schemaPath: "#/properties/events/type",
                          keyword: "type",
                          params: { type: "object" },
                          message: "must be object",
                        },
                      ];
                      return false;
                    }
                  }
                  var valid0 = _errs11 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.actors !== undefined) {
                    let data5 = data.actors;
                    const _errs17 = errors;
                    if (errors === _errs17) {
                      if (data5 && typeof data5 == "object" && !Array.isArray(data5)) {
                        for (const key2 in data5) {
                          let data6 = data5[key2];
                          const _errs20 = errors;
                          if (errors === _errs20) {
                            if (data6 && typeof data6 == "object" && !Array.isArray(data6)) {
                              let missing1;
                              if (
                                (data6.input === undefined && (missing1 = "input")) ||
                                (data6.output === undefined && (missing1 = "output"))
                              ) {
                                validate61.errors = [
                                  {
                                    instancePath:
                                      instancePath +
                                      "/actors/" +
                                      key2.replace(/~/g, "~0").replace(/\//g, "~1"),
                                    schemaPath: "#/properties/actors/additionalProperties/required",
                                    keyword: "required",
                                    params: { missingProperty: missing1 },
                                    message: "must have required property '" + missing1 + "'",
                                  },
                                ];
                                return false;
                              } else {
                                const _errs22 = errors;
                                for (const key3 in data6) {
                                  if (!(key3 === "input" || key3 === "output")) {
                                    validate61.errors = [
                                      {
                                        instancePath:
                                          instancePath +
                                          "/actors/" +
                                          key2.replace(/~/g, "~0").replace(/\//g, "~1"),
                                        schemaPath:
                                          "#/properties/actors/additionalProperties/additionalProperties",
                                        keyword: "additionalProperties",
                                        params: { additionalProperty: key3 },
                                        message: "must NOT have additional properties",
                                      },
                                    ];
                                    return false;
                                    break;
                                  }
                                }
                                if (_errs22 === errors) {
                                  if (data6.input !== undefined) {
                                    let data7 = data6.input;
                                    const _errs23 = errors;
                                    if (
                                      !(
                                        data7 &&
                                        typeof data7 == "object" &&
                                        !Array.isArray(data7)
                                      ) &&
                                      typeof data7 !== "boolean"
                                    ) {
                                      validate61.errors = [
                                        {
                                          instancePath:
                                            instancePath +
                                            "/actors/" +
                                            key2.replace(/~/g, "~0").replace(/\//g, "~1") +
                                            "/input",
                                          schemaPath: "#/$defs/json-schema/type",
                                          keyword: "type",
                                          params: { type: schema61.type },
                                          message: "must be object,boolean",
                                        },
                                      ];
                                      return false;
                                    }
                                    var valid7 = _errs23 === errors;
                                  } else {
                                    var valid7 = true;
                                  }
                                  if (valid7) {
                                    if (data6.output !== undefined) {
                                      let data8 = data6.output;
                                      const _errs26 = errors;
                                      if (
                                        !(
                                          data8 &&
                                          typeof data8 == "object" &&
                                          !Array.isArray(data8)
                                        ) &&
                                        typeof data8 !== "boolean"
                                      ) {
                                        validate61.errors = [
                                          {
                                            instancePath:
                                              instancePath +
                                              "/actors/" +
                                              key2.replace(/~/g, "~0").replace(/\//g, "~1") +
                                              "/output",
                                            schemaPath: "#/$defs/json-schema/type",
                                            keyword: "type",
                                            params: { type: schema61.type },
                                            message: "must be object,boolean",
                                          },
                                        ];
                                        return false;
                                      }
                                      var valid7 = _errs26 === errors;
                                    } else {
                                      var valid7 = true;
                                    }
                                  }
                                }
                              }
                            } else {
                              validate61.errors = [
                                {
                                  instancePath:
                                    instancePath +
                                    "/actors/" +
                                    key2.replace(/~/g, "~0").replace(/\//g, "~1"),
                                  schemaPath: "#/properties/actors/additionalProperties/type",
                                  keyword: "type",
                                  params: { type: "object" },
                                  message: "must be object",
                                },
                              ];
                              return false;
                            }
                          }
                          var valid6 = _errs20 === errors;
                          if (!valid6) {
                            break;
                          }
                        }
                      } else {
                        validate61.errors = [
                          {
                            instancePath: instancePath + "/actors",
                            schemaPath: "#/properties/actors/type",
                            keyword: "type",
                            params: { type: "object" },
                            message: "must be object",
                          },
                        ];
                        return false;
                      }
                    }
                    var valid0 = _errs17 === errors;
                  } else {
                    var valid0 = true;
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate61.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate61.errors = vErrors;
  return errors === 0;
}
validate61.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
const schema67 = {
  description: "Where the blueprint editor's canvas draws each state. The machine never reads it.",
  type: "object",
  additionalProperties: false,
  properties: {
    states: {
      description:
        "The top-left corner of each state, by state path, relative to its parent state's corner, or to the canvas origin for a top-level state. A path that names no state is ignored.",
      type: "object",
      propertyNames: { $ref: "#/$defs/state-path" },
      additionalProperties: { $ref: "#/$defs/layout-point" },
    },
  },
};
const schema69 = {
  type: "object",
  required: ["x", "y"],
  additionalProperties: false,
  properties: { x: { type: "integer" }, y: { type: "integer" } },
};
function validate63(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate63.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      const _errs1 = errors;
      for (const key0 in data) {
        if (!(key0 === "states")) {
          validate63.errors = [
            {
              instancePath,
              schemaPath: "#/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key0 },
              message: "must NOT have additional properties",
            },
          ];
          return false;
          break;
        }
      }
      if (_errs1 === errors) {
        if (data.states !== undefined) {
          let data0 = data.states;
          const _errs2 = errors;
          if (errors === _errs2) {
            if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
              for (const key1 in data0) {
                const _errs4 = errors;
                const _errs5 = errors;
                if (errors === _errs5) {
                  if (typeof key1 === "string") {
                    if (!pattern8.test(key1)) {
                      const err0 = {
                        instancePath: instancePath + "/states",
                        schemaPath: "#/$defs/state-path/pattern",
                        keyword: "pattern",
                        params: { pattern: "^[^.#]+(\\.[^.#]+)*$" },
                        message: 'must match pattern "' + "^[^.#]+(\\.[^.#]+)*$" + '"',
                        propertyName: key1,
                      };
                      if (vErrors === null) {
                        vErrors = [err0];
                      } else {
                        vErrors.push(err0);
                      }
                      errors++;
                    }
                  } else {
                    const err1 = {
                      instancePath: instancePath + "/states",
                      schemaPath: "#/$defs/state-path/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                      propertyName: key1,
                    };
                    if (vErrors === null) {
                      vErrors = [err1];
                    } else {
                      vErrors.push(err1);
                    }
                    errors++;
                  }
                }
                var valid1 = _errs4 === errors;
                if (!valid1) {
                  const err2 = {
                    instancePath: instancePath + "/states",
                    schemaPath: "#/properties/states/propertyNames",
                    keyword: "propertyNames",
                    params: { propertyName: key1 },
                    message: "property name must be valid",
                  };
                  if (vErrors === null) {
                    vErrors = [err2];
                  } else {
                    vErrors.push(err2);
                  }
                  errors++;
                  validate63.errors = vErrors;
                  return false;
                  break;
                }
              }
              if (valid1) {
                for (const key2 in data0) {
                  let data1 = data0[key2];
                  const _errs8 = errors;
                  const _errs9 = errors;
                  if (errors === _errs9) {
                    if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
                      let missing0;
                      if (
                        (data1.x === undefined && (missing0 = "x")) ||
                        (data1.y === undefined && (missing0 = "y"))
                      ) {
                        validate63.errors = [
                          {
                            instancePath:
                              instancePath +
                              "/states/" +
                              key2.replace(/~/g, "~0").replace(/\//g, "~1"),
                            schemaPath: "#/$defs/layout-point/required",
                            keyword: "required",
                            params: { missingProperty: missing0 },
                            message: "must have required property '" + missing0 + "'",
                          },
                        ];
                        return false;
                      } else {
                        const _errs11 = errors;
                        for (const key3 in data1) {
                          if (!(key3 === "x" || key3 === "y")) {
                            validate63.errors = [
                              {
                                instancePath:
                                  instancePath +
                                  "/states/" +
                                  key2.replace(/~/g, "~0").replace(/\//g, "~1"),
                                schemaPath: "#/$defs/layout-point/additionalProperties",
                                keyword: "additionalProperties",
                                params: { additionalProperty: key3 },
                                message: "must NOT have additional properties",
                              },
                            ];
                            return false;
                            break;
                          }
                        }
                        if (_errs11 === errors) {
                          if (data1.x !== undefined) {
                            let data2 = data1.x;
                            const _errs12 = errors;
                            if (!(typeof data2 == "number" && !(data2 % 1) && !isNaN(data2))) {
                              validate63.errors = [
                                {
                                  instancePath:
                                    instancePath +
                                    "/states/" +
                                    key2.replace(/~/g, "~0").replace(/\//g, "~1") +
                                    "/x",
                                  schemaPath: "#/$defs/layout-point/properties/x/type",
                                  keyword: "type",
                                  params: { type: "integer" },
                                  message: "must be integer",
                                },
                              ];
                              return false;
                            }
                            var valid5 = _errs12 === errors;
                          } else {
                            var valid5 = true;
                          }
                          if (valid5) {
                            if (data1.y !== undefined) {
                              let data3 = data1.y;
                              const _errs14 = errors;
                              if (!(typeof data3 == "number" && !(data3 % 1) && !isNaN(data3))) {
                                validate63.errors = [
                                  {
                                    instancePath:
                                      instancePath +
                                      "/states/" +
                                      key2.replace(/~/g, "~0").replace(/\//g, "~1") +
                                      "/y",
                                    schemaPath: "#/$defs/layout-point/properties/y/type",
                                    keyword: "type",
                                    params: { type: "integer" },
                                    message: "must be integer",
                                  },
                                ];
                                return false;
                              }
                              var valid5 = _errs14 === errors;
                            } else {
                              var valid5 = true;
                            }
                          }
                        }
                      }
                    } else {
                      validate63.errors = [
                        {
                          instancePath:
                            instancePath +
                            "/states/" +
                            key2.replace(/~/g, "~0").replace(/\//g, "~1"),
                          schemaPath: "#/$defs/layout-point/type",
                          keyword: "type",
                          params: { type: "object" },
                          message: "must be object",
                        },
                      ];
                      return false;
                    }
                  }
                  var valid3 = _errs8 === errors;
                  if (!valid3) {
                    break;
                  }
                }
              }
            } else {
              validate63.errors = [
                {
                  instancePath: instancePath + "/states",
                  schemaPath: "#/properties/states/type",
                  keyword: "type",
                  params: { type: "object" },
                  message: "must be object",
                },
              ];
              return false;
            }
          }
        }
      }
    } else {
      validate63.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate63.errors = vErrors;
  return errors === 0;
}
validate63.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
const schema70 = {
  description:
    "Maps the context of an actor on an earlier version whose context, without `manifold`, `from` accepts to this version's context.",
  type: "object",
  required: ["from", "context"],
  additionalProperties: false,
  properties: {
    description: { type: "string" },
    from: {
      description: "A JSON Schema of draft 2020-12 over the earlier context.",
      type: ["object", "boolean"],
    },
    context: {
      description: "A mapping whose result is the whole new context.",
      allOf: [
        {
          $ref: "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference",
        },
        { properties: { type: { const: "expression.map" } } },
      ],
    },
  },
};
function validate65(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate65.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.from === undefined && (missing0 = "from")) ||
        (data.context === undefined && (missing0 = "context"))
      ) {
        validate65.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "description" || key0 === "from" || key0 === "context")) {
            validate65.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.description !== undefined) {
            const _errs2 = errors;
            if (typeof data.description !== "string") {
              validate65.errors = [
                {
                  instancePath: instancePath + "/description",
                  schemaPath: "#/properties/description/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                },
              ];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.from !== undefined) {
              let data1 = data.from;
              const _errs4 = errors;
              if (
                !(data1 && typeof data1 == "object" && !Array.isArray(data1)) &&
                typeof data1 !== "boolean"
              ) {
                validate65.errors = [
                  {
                    instancePath: instancePath + "/from",
                    schemaPath: "#/properties/from/type",
                    keyword: "type",
                    params: { type: schema70.properties.from.type },
                    message: "must be object,boolean",
                  },
                ];
                return false;
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.context !== undefined) {
                let data2 = data.context;
                const _errs6 = errors;
                const _errs7 = errors;
                const _errs8 = errors;
                if (errors === _errs8) {
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    let missing1;
                    if (
                      (data2.type === undefined && (missing1 = "type")) ||
                      (data2.params === undefined && (missing1 = "params"))
                    ) {
                      validate65.errors = [
                        {
                          instancePath: instancePath + "/context",
                          schemaPath:
                            "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference/required",
                          keyword: "required",
                          params: { missingProperty: missing1 },
                          message: "must have required property '" + missing1 + "'",
                        },
                      ];
                      return false;
                    } else {
                      const _errs10 = errors;
                      for (const key1 in data2) {
                        if (!(key1 === "type" || key1 === "params")) {
                          validate65.errors = [
                            {
                              instancePath: instancePath + "/context",
                              schemaPath:
                                "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference/additionalProperties",
                              keyword: "additionalProperties",
                              params: { additionalProperty: key1 },
                              message: "must NOT have additional properties",
                            },
                          ];
                          return false;
                          break;
                        }
                      }
                      if (_errs10 === errors) {
                        if (data2.type !== undefined) {
                          let data3 = data2.type;
                          const _errs11 = errors;
                          if (
                            !(
                              data3 === "expression.guard" ||
                              data3 === "expression.match" ||
                              data3 === "expression.assign" ||
                              data3 === "expression.map"
                            )
                          ) {
                            validate65.errors = [
                              {
                                instancePath: instancePath + "/context/type",
                                schemaPath:
                                  "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference/properties/type/enum",
                                keyword: "enum",
                                params: { allowedValues: schema48.properties.type.enum },
                                message: "must be equal to one of the allowed values",
                              },
                            ];
                            return false;
                          }
                          var valid3 = _errs11 === errors;
                        } else {
                          var valid3 = true;
                        }
                        if (valid3) {
                          if (data2.params !== undefined) {
                            let data4 = data2.params;
                            const _errs12 = errors;
                            if (errors === _errs12) {
                              if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
                                let missing2;
                                if (data4.expression === undefined && (missing2 = "expression")) {
                                  validate65.errors = [
                                    {
                                      instancePath: instancePath + "/context/params",
                                      schemaPath:
                                        "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference/properties/params/required",
                                      keyword: "required",
                                      params: { missingProperty: missing2 },
                                      message: "must have required property '" + missing2 + "'",
                                    },
                                  ];
                                  return false;
                                } else {
                                  const _errs14 = errors;
                                  for (const key2 in data4) {
                                    if (!(key2 === "expression")) {
                                      validate65.errors = [
                                        {
                                          instancePath: instancePath + "/context/params",
                                          schemaPath:
                                            "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference/properties/params/additionalProperties",
                                          keyword: "additionalProperties",
                                          params: { additionalProperty: key2 },
                                          message: "must NOT have additional properties",
                                        },
                                      ];
                                      return false;
                                      break;
                                    }
                                  }
                                  if (_errs14 === errors) {
                                    if (data4.expression !== undefined) {
                                      let data5 = data4.expression;
                                      const _errs15 = errors;
                                      if (errors === _errs15) {
                                        if (typeof data5 === "string") {
                                          if (func1(data5) < 1) {
                                            validate65.errors = [
                                              {
                                                instancePath:
                                                  instancePath + "/context/params/expression",
                                                schemaPath:
                                                  "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference/properties/params/properties/expression/minLength",
                                                keyword: "minLength",
                                                params: { limit: 1 },
                                                message: "must NOT have fewer than 1 characters",
                                              },
                                            ];
                                            return false;
                                          }
                                        } else {
                                          validate65.errors = [
                                            {
                                              instancePath:
                                                instancePath + "/context/params/expression",
                                              schemaPath:
                                                "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference/properties/params/properties/expression/type",
                                              keyword: "type",
                                              params: { type: "string" },
                                              message: "must be string",
                                            },
                                          ];
                                          return false;
                                        }
                                      }
                                    }
                                  }
                                }
                              } else {
                                validate65.errors = [
                                  {
                                    instancePath: instancePath + "/context/params",
                                    schemaPath:
                                      "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference/properties/params/type",
                                    keyword: "type",
                                    params: { type: "object" },
                                    message: "must be object",
                                  },
                                ];
                                return false;
                              }
                            }
                            var valid3 = _errs12 === errors;
                          } else {
                            var valid3 = true;
                          }
                        }
                      }
                    }
                  } else {
                    validate65.errors = [
                      {
                        instancePath: instancePath + "/context",
                        schemaPath:
                          "https://manifold.wyrd.company/schemas/blueprint-expressions#/$defs/expression-reference/type",
                        keyword: "type",
                        params: { type: "object" },
                        message: "must be object",
                      },
                    ];
                    return false;
                  }
                }
                var valid1 = _errs7 === errors;
                if (valid1) {
                  const _errs17 = errors;
                  if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
                    if (data2.type !== undefined) {
                      if ("expression.map" !== data2.type) {
                        validate65.errors = [
                          {
                            instancePath: instancePath + "/context/type",
                            schemaPath: "#/properties/context/allOf/1/properties/type/const",
                            keyword: "const",
                            params: { allowedValue: "expression.map" },
                            message: "must be equal to constant",
                          },
                        ];
                        return false;
                      }
                    }
                  }
                  var valid1 = _errs17 === errors;
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
            }
          }
        }
      }
    } else {
      validate65.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate65.errors = vErrors;
  return errors === 0;
}
validate65.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate22(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate22.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.machine === undefined && (missing0 = "machine")) ||
        (data.schemas === undefined && (missing0 = "schemas"))
      ) {
        validate22.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (
            !(
              key0 === "description" ||
              key0 === "machine" ||
              key0 === "schemas" ||
              key0 === "layout" ||
              key0 === "migrations"
            )
          ) {
            validate22.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.description !== undefined) {
            const _errs2 = errors;
            if (typeof data.description !== "string") {
              validate22.errors = [
                {
                  instancePath: instancePath + "/description",
                  schemaPath: "#/properties/description/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                },
              ];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.machine !== undefined) {
              const _errs4 = errors;
              if (
                !validate23(data.machine, {
                  instancePath: instancePath + "/machine",
                  parentData: data,
                  parentDataProperty: "machine",
                  rootData,
                  dynamicAnchors,
                })
              ) {
                vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
                errors = vErrors.length;
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.schemas !== undefined) {
                const _errs5 = errors;
                if (
                  !validate61(data.schemas, {
                    instancePath: instancePath + "/schemas",
                    parentData: data,
                    parentDataProperty: "schemas",
                    rootData,
                    dynamicAnchors,
                  })
                ) {
                  vErrors =
                    vErrors === null ? validate61.errors : vErrors.concat(validate61.errors);
                  errors = vErrors.length;
                }
                var valid0 = _errs5 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.layout !== undefined) {
                  const _errs6 = errors;
                  if (
                    !validate63(data.layout, {
                      instancePath: instancePath + "/layout",
                      parentData: data,
                      parentDataProperty: "layout",
                      rootData,
                      dynamicAnchors,
                    })
                  ) {
                    vErrors =
                      vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
                    errors = vErrors.length;
                  }
                  var valid0 = _errs6 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.migrations !== undefined) {
                    let data4 = data.migrations;
                    const _errs7 = errors;
                    if (errors === _errs7) {
                      if (Array.isArray(data4)) {
                        var valid1 = true;
                        const len0 = data4.length;
                        for (let i0 = 0; i0 < len0; i0++) {
                          const _errs9 = errors;
                          if (
                            !validate65(data4[i0], {
                              instancePath: instancePath + "/migrations/" + i0,
                              parentData: data4,
                              parentDataProperty: i0,
                              rootData,
                              dynamicAnchors,
                            })
                          ) {
                            vErrors =
                              vErrors === null
                                ? validate65.errors
                                : vErrors.concat(validate65.errors);
                            errors = vErrors.length;
                          }
                          var valid1 = _errs9 === errors;
                          if (!valid1) {
                            break;
                          }
                        }
                      } else {
                        validate22.errors = [
                          {
                            instancePath: instancePath + "/migrations",
                            schemaPath: "#/properties/migrations/type",
                            keyword: "type",
                            params: { type: "array" },
                            message: "must be array",
                          },
                        ];
                        return false;
                      }
                    }
                    var valid0 = _errs7 === errors;
                  } else {
                    var valid0 = true;
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate22.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate22.errors = vErrors;
  return errors === 0;
}
validate22.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate20(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate20.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (
    !validate22(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })
  ) {
    vErrors = vErrors === null ? validate22.errors : vErrors.concat(validate22.errors);
    errors = vErrors.length;
  }
  validate20.errors = vErrors;
  return errors === 0;
}
validate20.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
