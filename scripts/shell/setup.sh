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

echo ">> Setting up environment"

# ==== Aptos installation ====
APTOS_CLI_VERSION="4.2.6"

if [ "$CI" == true ]; then
  curl -sSfL -o /tmp/aptos.zip "https://github.com/aptos-labs/aptos-core/releases/download/aptos-cli-v$APTOS_CLI_VERSION/aptos-cli-$APTOS_CLI_VERSION-Ubuntu-22.04-x86_64.zip"
  sudo unzip /tmp/aptos.zip -d /usr/local/bin
  sudo chmod +x /usr/local/bin/*
else
  if [ "$(brew ls --versions aptos)" != "aptos $APTOS_CLI_VERSION" ]; then
    brew uninstall --force aptos && \
    # aptos 4.2.6's formula
    curl -s -o aptos.rb https://raw.githubusercontent.com/Homebrew/homebrew-core/ef458cb0a2574eb7d451090cbedc3942b77a7284/Formula/a/aptos.rb
    brew install --formula aptos.rb
    brew pin aptos
    rm aptos.rb
  fi
fi

# ==== Movefmt & Move prover installation ====
if [ -z $APTOS_BIN ]
then
  aptos update movefmt
  aptos update prover-dependencies
else
  aptos update movefmt --install-dir $APTOS_BIN
  aptos update prover-dependencies --install-dir $APTOS_BIN
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
