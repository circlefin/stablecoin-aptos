# stablecoin-aptos

Source repository for smart contracts used by Circle's stablecoins on Aptos blockchain

## Getting Started

### Prerequisites

Before you can start working with the contracts in this repository,

1. [Optional] Create a directory to store Aptos-related binaries:

   ```bash
   mkdir -p $HOME/.aptos/bin/
   echo 'export APTOS_BIN="$HOME/.aptos/bin"' >> ~/.zshrc
   echo 'export PATH="$APTOS_BIN:$PATH"' >> ~/.zshrc
   ```

2. Install the necessary tools

   ```bash
   make setup
   ```

A guide on installing the CLI tools in other environments can be found [here](https://aptos.dev/en/build/cli).

### IDE

The recommended IDE for this repository is VSCode. To get your IDE set up:

1. Install the recommended extensions in VSCode. Enter `@recommended` into the search bar in the Extensions panel and install each of the extensions
2. Install the [`aptos-move-analyzer`](https://github.com/movebit/aptos-move-analyzer) binary, ensuring that it can be found on your PATH

   ```sh
   mkdir -p $HOME/.aptos/bin/
   curl -L -o "$HOME/.aptos/bin/aptos-move-analyzer" "https://github.com/movebit/aptos-move-analyzer/releases/download/v1.0.0/aptos-move-analyzer-mac-x86_64-v1.0.0"
   chmod +x $HOME/.aptos/bin/aptos-move-analyzer
   echo 'export PATH="$HOME/.aptos/bin:$PATH"' >> ~/.zshrc
   ```

### Test Move contracts

1. Run all Move tests:

   ```bash
   make test
   ```

   Coverage info is printed by default with this command.

2. Code formatting:

   ```bash
   make fmt
   ```

## Localnet testing

To test the contracts on a localnet:

1. Start the local network.

   ```sh
   make start-network
   ```

2. Create a local account and fund it with APT

   ```sh
   make create-local-account
   ```

3. Deploy `aptos_extensions` and `stablecoin` packages, and initialize stablecoin state

   ```sh
   yarn scripts deploy-and-initialize-token \
      -r http://localhost:8080 \
      --deployer-key <PRIVATE_KEY> \
      --token-config-path ./scripts/typescript/resources/default_token.json
   ```

   [!NOTE]

   - The private key can be found inside `.aptos/keys/deployer.key`.
   - The deployment uses default configurations inside "./scripts/typescript/resources/default_token.json". For a real deployment, please make a copy of `scripts/typescript/resources/usdc_deploy_template.json` and fill in all settings.

4. [Optional] Upgrade the `stablecoin` packages

   ```sh
   yarn scripts upgrade-stablecoin-package \
      -r http://localhost:8080 \
      --admin-key <PRIVATE_KEY> \
      --payload-file-path <PUBLISH_PAYLOAD_FILE_PATH> \
      --aptos-extensions-package-id <ADDRESS> \
      --stablecoin-package-id <ADDRESS>
   ```

## Deploying to a live network

1. Create a deployer keypair and fund it with APT

   If deploying to a test environment (local/devnet/testnet), you can create and fund the account with the following CLI command

   ```sh
   # Local
   yarn scripts generate-keypair --prefund

   # Devnet
   yarn scripts generate-keypair --prefund --rpc-url "https://api.devnet.aptoslabs.com" --faucet-url "https://faucet.devnet.aptoslabs.com"

   # Testnet
   yarn scripts generate-keypair --prefund --rpc-url "https://api.testnet.aptoslabs.com" --faucet-url "https://faucet.testnet.aptoslabs.com"
   ```

   If deploying to mainnet, create a keypair and separately fund the account by purchasing APT.

   ```sh
   yarn scripts generate-keypair
   ```

2. Create token configuration by copying existing template.

   ```sh
   cp scripts/typescript/resources/usdc_deploy_template.json scripts/typescript/resources/<CONFIG_FILE_NAME>
   ```

   Fill out all configuration parameters.

3. Deploy `aptos_extensions` and `stablecoin` packages, and initialize stablecoin state

   ```sh
   yarn scripts deploy-and-initialize-token \
      -r http://localhost:8080 \
      --deployer-key <PRIVATE_KEY> \
      --token-config-path <TOKEN_CONFIG_FILE_PATH>
   ```

   Source code verification is disabled by default, but can be enabled via the `--verify-source` flag.

## Interacting with a deployed token

We have provided scripts that enable developers to interact with a deployed token. To view a list of available scripts and their options, use the following command:

```sh
yarn scripts --help
```

If you want to see the specific options for a particular script, replace `<SCRIPT_NAME>` with the name of the script and run:

```sh
yarn scripts <SCRIPT_NAME> --help
```
