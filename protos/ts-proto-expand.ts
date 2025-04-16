// ts-proto-expand.ts
import * as fs from 'fs';
import * as path from 'path';
import * as protobuf from 'protobufjs';

const MIXIN_OPTION = '(ts_proto_options.mixins)';

interface MessageWithFile {
  filePath: string;
  namespace: string[];
  message: protobuf.Type;
}

function extractMessages(root: protobuf.Root, filePath: string, namespace: string[] = []): MessageWithFile[] {
  const result: MessageWithFile[] = [];
  root.nestedArray.forEach((nested) => {
    if (nested instanceof protobuf.Type) {
      result.push({ filePath, namespace, message: nested });
    } else if (nested instanceof protobuf.Namespace) {
      result.push(...extractMessages(nested as any, filePath, [...namespace, nested.name]));
    }
  });
  return result;
}

function expandMixins(messages: MessageWithFile[]): Map<string, protobuf.Type> {
  const messageMap = new Map(messages.map((m) => [m.namespace.concat(m.message.name).join('.'), m.message]));
  const expanded = new Map<string, protobuf.Type>();

  for (const { message, namespace } of messages) {
    const fqName = namespace.concat(message.name).join('.');
    const options = message.options || {};

    // Support multiple mixin declarations like:
    // option (ts_proto_options.mixins) = "A";
    // option (ts_proto_options.mixins) = "B";
    const rawMixins = Object.entries(options)
      .filter(([k, _]) => k === MIXIN_OPTION)
      .map(([_, v]) => v);

    const mixins: string[] = ([] as string[]).concat(...rawMixins);
    if (mixins.length === 0) continue;

    const expandedFields = new Map<number, protobuf.Field>();

    // copy mixin fields
    for (const mixinName of mixins) {
      const mixin = messageMap.get(mixinName);
      if (!mixin) throw new Error(`Mixin '${mixinName}' not found`);

      for (const field of Object.values(mixin.fields)) {
        if (expandedFields.has(field.id)) {
          throw new Error(`Field number conflict on '${field.name}' (tag ${field.id}) in ${message.name}`);
        }
        expandedFields.set(field.id, new protobuf.Field(field.name, field.id, field.type, field.repeated ? 'repeated' : undefined, field.extend, field.options));
      }
    }

    // copy own fields
    for (const field of Object.values(message.fields)) {
      if (expandedFields.has(field.id)) {
        throw new Error(`Field number conflict on '${field.name}' (tag ${field.id}) in ${message.name}`);
      }
      expandedFields.set(field.id, new protobuf.Field(field.name, field.id, field.type, field.repeated ? 'repeated' : undefined, field.extend, field.options));
    }

    // rebuild the message
    const newMsg = new protobuf.Type(message.name);
    for (const field of expandedFields.values()) {
      newMsg.add(field);
    }
    expanded.set(fqName, newMsg);
  }

  return expanded;
}

function writeExpandedProto(originalPath: string, message: protobuf.Type, outDir: string) {
  const protoName = path.basename(originalPath);
  const outputPath = path.join(outDir, protoName);
  const lines: string[] = [
    'syntax = "proto3";',
    '',
    `message ${message.name} {`
  ];

  for (const field of Object.values(message.fields)) {
    lines.push(`  ${field.repeated ? 'repeated ' : ''}${field.type} ${field.name} = ${field.id};`);
  }

  lines.push('}');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, lines.join('\n'));
}

async function expandProtoFiles(inputFiles: string[], outDir: string) {
  const allMessages: MessageWithFile[] = [];

  for (const filePath of inputFiles) {
    const root = await protobuf.load(filePath);
    allMessages.push(...extractMessages(root, filePath));
  }

  const expanded = expandMixins(allMessages);

  for (const [fqName, message] of expanded.entries()) {
    const source = allMessages.find(m => m.namespace.concat(m.message.name).join('.') === fqName);
    if (!source) continue;
    writeExpandedProto(source.filePath, message, outDir);
  }
}

// CLI usage: ts-node ts-proto-expand.ts src/protos/*.proto --out .gen/proto
if (require.main === module) {
  const args = process.argv.slice(2);
  const outFlagIndex = args.indexOf('--out');
  if (outFlagIndex === -1 || !args[outFlagIndex + 1]) {
    console.error('Usage: ts-node ts-proto-expand.ts <files...> --out <outDir>');
    process.exit(1);
  }

  const files = args.slice(0, outFlagIndex);
  const outDir = args[outFlagIndex + 1];

  expandProtoFiles(files, outDir).then(() => {
    console.log('✅ Expansion complete');
  }).catch((err) => {
    console.error('❌ Expansion failed:', err);
    process.exit(1);
  });
}