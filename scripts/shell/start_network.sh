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

aptos node run-local-testnet --force-restart --with-indexer-api --assume-yes &> $LOG_FILE &

WAIT_TIME=120
echo ">> Waiting for Aptos node to come online within $WAIT_TIME seconds..."

ELAPSED=0
SECONDS=0 
while [[ "$ELAPSED" -lt "$WAIT_TIME" ]]
do
  HEALTHCHECK_STATUS_CODE="$(curl -k -s -o /dev/null -w %{http_code} http://localhost:8070)"
  if [[ "$HEALTHCHECK_STATUS_CODE" -eq 200 ]]
  then 
    echo ">> Aptos node is started after $ELAPSED seconds!"
    cat $LOG_FILE
    echo ">> Opening explorer at https://explorer.aptoslabs.com/?network=local"
    open https://explorer.aptoslabs.com/?network=local
    exit 0
  fi
  
  if [[ $(( ELAPSED % 5 )) == 0 && "$ELAPSED" > 0 ]]
  then
    echo ">> Waiting for Aptos node for $ELAPSED seconds.."
  fi
  
  sleep 1
  ELAPSED=$SECONDS
done
