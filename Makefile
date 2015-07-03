
BIN = ./node_modules/.bin
MOCHA = $(BIN)/mocha
ESLINT = $(BIN)/eslint

test:
	$(MOCHA)

eslint: index.js ./test/*.js
	$(ESLINT) $^

.PHONY: test eslint
