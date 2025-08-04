#!/bin/bash
#
# Copyright 2024 Circle Internet Group, Inc. All rights reserved.
# 
# SPDX-License-Identifier: Apache-2.0
# 
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# 
#     http://www.apache.org/licenses/LICENSE-2.0
# 
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

set -e

if [[ "$CI" == true ]]
then
  OS="Ubuntu-22.04-x86_64"
else
  OS="macOS-arm64"
fi

echo ">> Setting up environment"


# ==== Aptos installation ====
APTOS_CLI_VERSION="7.5.0"
APTOS_BIN="${APTOS_BIN:-$HOME/.aptos/bin}"

if ! command -v aptos &> /dev/null || ! aptos -V | grep -q "aptos $APTOS_CLI_VERSION"
then
  echo "Installing Aptos binary from Github..."
  echo ">> Version: '$APTOS_CLI_VERSION'"
  echo ">> OS: '$OS'"

  # Download and extract Aptos binaries.
  rm -rf "$APTOS_BIN"
  mkdir -p "$APTOS_BIN"
  curl -L -o "$APTOS_BIN/aptos-v$APTOS_CLI_VERSION.zip" "https://github.com/aptos-labs/aptos-core/releases/download/aptos-cli-v$APTOS_CLI_VERSION/aptos-cli-$APTOS_CLI_VERSION-$OS.zip"
  unzip -o "$APTOS_BIN/aptos-v$APTOS_CLI_VERSION.zip" -d "$APTOS_BIN"
  rm "$APTOS_BIN/aptos-v$APTOS_CLI_VERSION.zip"

  # Sanity check that the Aptos binary was installed correctly
  echo "Checking aptos installation..."
  if ! "$APTOS_BIN/aptos" -V | grep -q "aptos $APTOS_CLI_VERSION"
  then
    echo "Aptos binary was not installed correctly"
    exit 1
  fi

  if [[ "$CI" == true ]]
  then
    echo "$APTOS_BIN" >> $GITHUB_PATH
  else
    echo "    Aptos binary installed successfully. Run the following command to add 'aptos' to your shell"
    echo "    echo 'export PATH=\"$APTOS_BIN:\$PATH\"' >> ~/.zshrc"
  fi
fi


# ==== Yarn Installation ====
YARN_VERSION="^1.x.x"
YARN_VERSION_REGEX="^1\..*\..*"

if ! command -v yarn &> /dev/null || ! yarn --version | grep -q "$YARN_VERSION_REGEX"
then
  echo "Installing yarn..."
  npm install -g "yarn@$YARN_VERSION"

  # Sanity check that yarn was installed correctly
  echo "Checking yarn installation..."
  if ! yarn --version | grep -q "$YARN_VERSION_REGEX"
  then
    echo "Yarn was not installed correctly"
    exit 1
  fi
fi

# ==== NPM Packages Installation ====
yarn install --frozen-lockfile -s
