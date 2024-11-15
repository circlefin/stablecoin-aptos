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

import { program } from "commander";

import acceptAdmin from "./acceptAdmin";
import acceptOwnership from "./acceptOwnership";
import calculateDeploymentAddresses from "./calculateDeploymentAddresses";
import changeAdmin from "./changeAdmin";
import configureController from "./configureController";
import configureMinter from "./configureMinter";
import deployAndInitializeToken from "./deployAndInitializeToken";
import generateKeypair from "./generateKeypair";
import removeController from "./removeController";
import removeMinter from "./removeMinter";
import transferOwnership from "./transferOwnership";
import updateBlocklister from "./updateBlocklister";
import updateMasterMinter from "./updateMasterMinter";
import updateMetadataUpdater from "./updateMetadataUpdater";
import updatePauser from "./updatePauser";
import upgradeStablecoinPackage from "./upgradeStablecoinPackage";
import validateStablecoinState from "./validateStablecoinState";
import verifyPackage from "./verifyPackage";
import verifyV1Packages from "./verifyV1Packages";

program
  .name("scripts")
  .description("Scripts related to Aptos development")
  .addCommand(acceptAdmin)
  .addCommand(acceptOwnership)
  .addCommand(calculateDeploymentAddresses)
  .addCommand(changeAdmin)
  .addCommand(configureController)
  .addCommand(configureMinter)
  .addCommand(deployAndInitializeToken)
  .addCommand(generateKeypair)
  .addCommand(removeController)
  .addCommand(removeMinter)
  .addCommand(transferOwnership)
  .addCommand(updateBlocklister)
  .addCommand(updateMasterMinter)
  .addCommand(updateMetadataUpdater)
  .addCommand(updatePauser)
  .addCommand(upgradeStablecoinPackage)
  .addCommand(validateStablecoinState)
  .addCommand(verifyPackage)
  .addCommand(verifyV1Packages);

if (process.env.NODE_ENV !== "TESTING") {
  program.parse();
}
