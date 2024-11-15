/**
 * Copyright 2024 Circle Internet Group, Inc. All rights reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from "fs";
import * as yup from "yup";

export type PublishPayload = yup.InferType<typeof publishPayloadSchema>;

const hexString = yup
  .string()
  .matches(/0x[a-f]*/)
  .required();

const publishPayloadSchema = yup.object({
  args: yup
    .tuple([
      yup.object({
        type: yup.string().oneOf(["hex"]).required(),
        value: hexString
      }),
      yup.object({
        type: yup.string().oneOf(["hex"]).required(),
        value: yup.array(hexString).required()
      })
    ])
    .required()
});

/**
 * Reads and validates the build-publish-payload output.
 * @param payloadFilePath Path to a valid build-publish-payload output.
 * @returns The parsed and validated publish payload.
 */
export function readPublishPayload(payloadFilePath: string): PublishPayload {
  if (!fs.existsSync(payloadFilePath)) {
    throw new Error(`Failed to load payload file: ${payloadFilePath}`);
  }

  const payload = publishPayloadSchema.validateSync(
    JSON.parse(fs.readFileSync(payloadFilePath, "utf-8")),
    { abortEarly: true }
  );

  return payload;
}
