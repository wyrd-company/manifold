// ---
// relationships:
//   implements: usage-push
// ---
import type { ValidateFunction } from "ajv";
import { Ajv2020 } from "ajv/dist/2020.js";
import { serviceConfigurationSchemas } from "./service-configuration-schemas.ts";
import { usagePushSchema, usageRecordSchema } from "./usage-schemas.generated.ts";
import type { UsagePushResult } from "./usage-types.ts";
const ajv = new Ajv2020({ strict: false, validateFormats: false });
for (const schema of serviceConfigurationSchemas) ajv.addSchema(schema);
ajv.addSchema(usageRecordSchema);
ajv.addSchema(usagePushSchema);
let validator: ValidateFunction<UsagePushResult> | undefined;
export function isUsagePushResult(value: unknown): value is UsagePushResult {
  validator ??= ajv.compile<UsagePushResult>({ $ref: usagePushSchema.$id + "#/$defs/response" });
  return validator(value);
}
