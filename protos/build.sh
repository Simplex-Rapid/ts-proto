#!/usr/bin/env bash

# Generates TS objects of the protoc plugin descriptors, which ts-proto
# uses to understand the incoming protoc codegen request objects.

protoc \
  --plugin=./node_modules/ts-proto/protoc-gen-ts_proto \
  --ts_proto_out=. \
  --ts_proto_opt=esModuleInterop=true,useExactTypes=false,initializeFieldsAsUndefined=false,exportCommonSymbols=false,unknownFields=true,usePrototypeForDefaults=true,outputExtensions=true,disableProto2Optionals=true \
  ./google/protobuf/descriptor.proto \
  ./google/protobuf/compiler/plugin.proto \
  # ./plugins/ts_proto_options.proto


# protoc \
#   --plugin=protoc-gen-ts_proto=/Users/alex/simplex-project/ts-proto/protoc-gen-ts_proto \
#   --ts_proto_out=. \
#   --ts_proto_opt=esModuleInterop=true,useExactTypes=false,initializeFieldsAsUndefined=false,exportCommonSymbols=false,unknownFields=true,usePrototypeForDefaults=true,outputExtensions=true,disableProto2Optionals=true,useInheritance=true,exportInterfaces=false \
#   ./google/protobuf/descriptor.proto \
#   ./google/protobuf/compiler/plugin.proto \
#   ./test/DatabaseCollectionDocumentBaseFields.proto \
#   ./test/MachineManualDocument.proto \
#   ./test/ts_proto_options.proto

./node_modules/.bin/tsc -p tsconfig.json

