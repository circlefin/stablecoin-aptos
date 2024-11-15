.PHONY: setup static-checks fmt lint clean build-publish-payload build-dev prove test start-network stop-network create-local-account

# === Move compiler settings ===

# Refer to https://github.com/aptos-labs/aptos-core/blob/687937182b30f32895d13e4384a96e03f569468c/third_party/move/move-model/src/metadata.rs#L80
compiler_version = 1

# Refer to https://github.com/aptos-labs/aptos-core/blob/687937182b30f32895d13e4384a96e03f569468c/third_party/move/move-model/src/metadata.rs#L179
# NOTE: The bytecode_version used during compilation is auto-inferred from this setting. Refer to https://github.com/aptos-labs/aptos-core/blob/687937182b30f32895d13e4384a96e03f569468c/third_party/move/move-model/src/metadata.rs#L235-L241
# for more information.
language_version = 1

setup:
	@bash scripts/shell/setup.sh

static-checks:
	@yarn format:check && yarn type-check && yarn lint && make lint

fmt:
	@packages=$$(find "packages" -type d -mindepth 1 -maxdepth 1); \
	for package in $$packages; do \
		aptos move fmt --package-path $$package --config max_width=120; \
	done;

lint:
	@packages=$$(find "packages" -type d -mindepth 1 -maxdepth 1); \
	for package in $$packages; do \
		echo ">> Running linter on $$package" && \
		LINT_RESULTS="$$(\
			aptos move lint \
				--package-dir $$package \
				--language-version "$(language_version)" \
				--dev 2>&1 \
		)" && \
		if $$(echo "$$LINT_RESULTS" | grep "warning" --quiet); then \
			echo ">> Linting failed for $$package\n"; \
			echo "$$LINT_RESULTS"; \
			exit 1; \
		fi; \
	done

clean:
	@packages=$$(find "packages" -type d -mindepth 1 -maxdepth 1); \
	for package in $$packages; do \
		echo ">> Cleaning $$package..."; \
		rm -rf $$package/build; \
		rm -f $$package/.coverage_map.mvcov; \
		rm -f $$package/.trace; \
	done; \
	echo ">> Cleaning TS script build output..."; \
	rm -rf scripts/typescript/build-output

build-publish-payload: clean
	@if [ -z "$(package)" ] || [ -z "$(output)" ] || [ -z "$(included_artifacts)" ]; then \
		echo "Usage: make build-publish-payload package=\"<package_name>\" output=\"<output_path>\" included_artifacts=\"<all/sparse/none>\" [named_addresses=\"<named_addresses>\"]"; \
		exit 1; \
	fi; \
	\
	mkdir -p "$$(dirname "$(output)")"; \
	echo ">> Building $$package..."; \
	aptos move build-publish-payload \
	  --assume-yes \
		--package-dir "packages/$(package)" \
		--named-addresses "$(named_addresses)" \
		--language-version "$(language_version)" \
		--compiler-version "$(compiler_version)" \
		--json-output-file "$(output)" \
		--included-artifacts "$(included_artifacts)";

verify-metadata:
	@if [ -z "$(package)" ] || [ -z "$(package_id)" ] || [ -z "$(url)" ] || [ -z "$(included_artifacts)" ]; then \
		echo "Usage: make verify-package package=\"<package_name>\" package_id=\"<package_id>\" included_artifacts=\"<all/sparse/none>\" url=\"<url>\" [named_addresses=\"<named_addresses>\"]"; \
		exit 1; \
	fi; \
	\
	aptos move verify-package \
		--package-dir "packages/$(package)" \
		--account "$(package_id)" \
		--named-addresses "$(named_addresses)" \
		--language-version "$(language_version)" \
		--compiler-version "$(compiler_version)" \
		--included-artifacts "$(included_artifacts)" \
		--url "${url}";

build-dev: clean
	@packages=$$(find "packages" -type d -mindepth 1 -maxdepth 1); \
	for package in $$packages; do \
		echo ">> Building $$package in dev mode..."; \
		aptos move compile \
			--dev \
			--package-dir $$package \
			--language-version "$(language_version)" \
			--compiler-version "$(compiler_version)"; \
	done

prove: clean
	@packages=$$(find "packages" -type d -mindepth 1 -maxdepth 1); \
	for package in $$packages; do \
		echo ">> Running Move Prover for $$package..."; \
		aptos move prove \
			--package-dir $$package \
			--dev \
			--language-version "$(language_version)" \
			--compiler-version "$(compiler_version)"; \
	done

test: clean
	@packages=$$(find "packages" -type d -mindepth 1 -maxdepth 1); \
	for package in $$packages; do \
		echo ">> Testing $$package..."; \
		aptos move test \
			--package-dir $$package \
			--coverage \
			--dev \
			--language-version "$(language_version)" \
			--compiler-version "$(compiler_version)"; \
		\
		COVERAGE_RESULTS=$$(\
			aptos move coverage summary \
				--package-dir $$package \
				--dev \
				--language-version "$(language_version)" \
				--compiler-version "$(compiler_version)" \
		); \
		\
		if [ -z "$$(echo "$$COVERAGE_RESULTS" | grep "% Move Coverage: 100.00")" ]; then \
			echo ">> Coverage is not at 100%!"; \
			exit 1; \
		fi; \
	done

log_file = $(shell pwd)/aptos-node.log

start-network: stop-network
	@bash scripts/shell/start_network.sh

stop-network:
	@bash scripts/shell/stop_network.sh

create-local-account:
	@mkdir -p .aptos/keys && \
	if [ ! -f .aptos/keys/deployer.key ]; then \
		aptos key generate --key-type ed25519 --output-file .aptos/keys/deployer.key; \
	fi && \
	aptos init --profile deployer --network local --private-key-file .aptos/keys/deployer.key --assume-yes
