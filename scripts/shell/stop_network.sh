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

LOG_FILE="$PWD/aptos-node.log"
if [ -f "$LOG_FILE" ]
then
  rm "$LOG_FILE"
fi

# Find the PID of the node using the lsof command
# -t = only return port number
# -c aptos = where command name is 'aptos'
# -a = <AND>
# -i:8080 = where the port is '8080'
PID=$(lsof -t -c aptos -a -i:8080 || true)

if [ ! -z "$PID" ]
then
  echo "Stopping network at pid: $PID..."
  kill "$PID" &>/dev/null
fi
