import {
  DescriptorProto,
  EnumDescriptorProto,
  FileDescriptorProto,
  ServiceDescriptorProto,
} from "ts-proto-descriptors";
import { wrapTypeName } from "./utils";
import SourceInfo, { Fields } from "./sourceInfo";
import { Options } from "./options";
import { maybeSnakeToCamel } from "./case";

type MessageVisitor = (
  fullName: string,
  desc: DescriptorProto,
  sourceInfo: SourceInfo,
  fullProtoTypeName: string,
) => void;

type EnumVisitor = (
  fullName: string,
  desc: EnumDescriptorProto,
  sourceInfo: SourceInfo,
  fullProtoTypeName: string,
) => void;

export function visit(
  proto: FileDescriptorProto | DescriptorProto,
  sourceInfo: SourceInfo,
  messageFn: MessageVisitor,
  options: Options,
  enumFn: EnumVisitor = () => {},
  tsPrefix: string = "",
  protoPrefix: string = "",
): void {
  const isRootFile = "syntax" in proto;
  const childEnumType = isRootFile ? Fields.file.enum_type : Fields.message.enum_type;

  proto.enumType.forEach((enumDesc, index) => {
    // I.e. Foo_Bar.Zaz_Inner
    const protoFullName = protoPrefix + enumDesc.name;
    // I.e. FooBar_ZazInner
    const tsFullName = tsPrefix + maybeSnakeToCamel(enumDesc.name, options);
    const tsFullNameWithAffixes = messageName(wrapTypeName(options, tsFullName));
    const nestedSourceInfo = sourceInfo.open(childEnumType, index);
    enumFn(tsFullNameWithAffixes, enumDesc, nestedSourceInfo, protoFullName);
  });

  const messages = "messageType" in proto ? proto.messageType : proto.nestedType;
  const childType = isRootFile ? Fields.file.message_type : Fields.message.nested_type;

  messages.forEach((message, index) => {
    // I.e. Foo_Bar.Zaz_Inner
    const protoFullName = protoPrefix + message.name;
    // I.e. FooBar_ZazInner
    const tsFullName = tsPrefix + maybeSnakeToCamel(message.name, options);
    const tsFullNameWithAffixes = messageName(wrapTypeName(options, tsFullName));
    const nestedSourceInfo = sourceInfo.open(childType, index);
    messageFn(tsFullNameWithAffixes, message, nestedSourceInfo, protoFullName);
    const delim = options.useSnakeTypeName ? "_" : "";
    visit(message, nestedSourceInfo, messageFn, options, enumFn, tsFullName + delim, protoFullName + ".");
  });
}

const builtInNames = ["Date", "Function"];

/** Potentially suffixes `Message` to names to avoid conflicts, i.e. with `Date`. */
function messageName(name: string): string {
  return builtInNames.includes(name) ? `${name}Message` : name;
}

export function visitServices(
  proto: FileDescriptorProto,
  sourceInfo: SourceInfo,
  serviceFn: (desc: ServiceDescriptorProto, sourceInfo: SourceInfo) => void,
): void {
  proto.service.forEach((serviceDesc, index) => {
    const nestedSourceInfo = sourceInfo.open(Fields.file.service, index);
    serviceFn(serviceDesc, nestedSourceInfo);
  });
}
