/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
import $protobuf from "protobufjs/minimal.js";

// Common aliases
const $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const opentelemetry = $root.opentelemetry = (() => {

    /**
     * Namespace opentelemetry.
     * @exports opentelemetry
     * @namespace
     */
    const opentelemetry = {};

    opentelemetry.proto = (function() {

        /**
         * Namespace proto.
         * @memberof opentelemetry
         * @namespace
         */
        const proto = {};

        proto.collector = (function() {

            /**
             * Namespace collector.
             * @memberof opentelemetry.proto
             * @namespace
             */
            const collector = {};

            collector.trace = (function() {

                /**
                 * Namespace trace.
                 * @memberof opentelemetry.proto.collector
                 * @namespace
                 */
                const trace = {};

                trace.v1 = (function() {

                    /**
                     * Namespace v1.
                     * @memberof opentelemetry.proto.collector.trace
                     * @namespace
                     */
                    const v1 = {};

                    v1.ExportTraceServiceRequest = (function() {

                        /**
                         * Properties of an ExportTraceServiceRequest.
                         * @memberof opentelemetry.proto.collector.trace.v1
                         * @interface IExportTraceServiceRequest
                         * @property {Array.<opentelemetry.proto.trace.v1.IResourceSpans>|null} [resourceSpans] ExportTraceServiceRequest resourceSpans
                         */

                        /**
                         * Constructs a new ExportTraceServiceRequest.
                         * @memberof opentelemetry.proto.collector.trace.v1
                         * @classdesc Represents an ExportTraceServiceRequest.
                         * @implements IExportTraceServiceRequest
                         * @constructor
                         * @param {opentelemetry.proto.collector.trace.v1.IExportTraceServiceRequest=} [properties] Properties to set
                         */
                        function ExportTraceServiceRequest(properties) {
                            this.resourceSpans = [];
                            if (properties)
                                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                        this[keys[i]] = properties[keys[i]];
                        }

                        /**
                         * ExportTraceServiceRequest resourceSpans.
                         * @member {Array.<opentelemetry.proto.trace.v1.IResourceSpans>} resourceSpans
                         * @memberof opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest
                         * @instance
                         */
                        ExportTraceServiceRequest.prototype.resourceSpans = $util.emptyArray;

                        /**
                         * Encodes the specified ExportTraceServiceRequest message. Does not implicitly {@link opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest.verify|verify} messages.
                         * @function encode
                         * @memberof opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest
                         * @static
                         * @param {opentelemetry.proto.collector.trace.v1.IExportTraceServiceRequest} message ExportTraceServiceRequest message or plain object to encode
                         * @param {$protobuf.Writer} [writer] Writer to encode to
                         * @returns {$protobuf.Writer} Writer
                         */
                        ExportTraceServiceRequest.encode = function encode(message, writer, q) {
                            if (!writer)
                                writer = $Writer.create();
                            if (q === undefined)
                                q = 0;
                            if (q > $util.recursionLimit)
                                throw Error("max depth exceeded");
                            if (message.resourceSpans != null && message.resourceSpans.length)
                                for (let i = 0; i < message.resourceSpans.length; ++i)
                                    $root.opentelemetry.proto.trace.v1.ResourceSpans.encode(message.resourceSpans[i], writer.uint32(/* id 1, wireType 2 =*/10).fork(), q + 1).ldelim();
                            return writer;
                        };

                        /**
                         * Decodes an ExportTraceServiceRequest message from the specified reader or buffer.
                         * @function decode
                         * @memberof opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest
                         * @static
                         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                         * @param {number} [length] Message length if known beforehand
                         * @returns {opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest} ExportTraceServiceRequest
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        ExportTraceServiceRequest.decode = function decode(reader, length, error, long) {
                            if (!(reader instanceof $Reader))
                                reader = $Reader.create(reader);
                            if (long === undefined)
                                long = 0;
                            if (long > $Reader.recursionLimit)
                                throw Error("maximum nesting depth exceeded");
                            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest();
                            while (reader.pos < end) {
                                let tag = reader.uint32();
                                if (tag === error)
                                    break;
                                switch (tag >>> 3) {
                                case 1: {
                                        if (!(message.resourceSpans && message.resourceSpans.length))
                                            message.resourceSpans = [];
                                        message.resourceSpans.push($root.opentelemetry.proto.trace.v1.ResourceSpans.decode(reader, reader.uint32(), undefined, long + 1));
                                        break;
                                    }
                                default:
                                    reader.skipType(tag & 7, long);
                                    break;
                                }
                            }
                            return message;
                        };

                        /**
                         * Gets the default type url for ExportTraceServiceRequest
                         * @function getTypeUrl
                         * @memberof opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest
                         * @static
                         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns {string} The default type url
                         */
                        ExportTraceServiceRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                            if (typeUrlPrefix === undefined) {
                                typeUrlPrefix = "type.googleapis.com";
                            }
                            return typeUrlPrefix + "/opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest";
                        };

                        return ExportTraceServiceRequest;
                    })();

                    v1.ExportTraceServiceResponse = (function() {

                        /**
                         * Properties of an ExportTraceServiceResponse.
                         * @memberof opentelemetry.proto.collector.trace.v1
                         * @interface IExportTraceServiceResponse
                         * @property {opentelemetry.proto.collector.trace.v1.IExportTracePartialSuccess|null} [partialSuccess] ExportTraceServiceResponse partialSuccess
                         */

                        /**
                         * Constructs a new ExportTraceServiceResponse.
                         * @memberof opentelemetry.proto.collector.trace.v1
                         * @classdesc Represents an ExportTraceServiceResponse.
                         * @implements IExportTraceServiceResponse
                         * @constructor
                         * @param {opentelemetry.proto.collector.trace.v1.IExportTraceServiceResponse=} [properties] Properties to set
                         */
                        function ExportTraceServiceResponse(properties) {
                            if (properties)
                                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                        this[keys[i]] = properties[keys[i]];
                        }

                        /**
                         * ExportTraceServiceResponse partialSuccess.
                         * @member {opentelemetry.proto.collector.trace.v1.IExportTracePartialSuccess|null|undefined} partialSuccess
                         * @memberof opentelemetry.proto.collector.trace.v1.ExportTraceServiceResponse
                         * @instance
                         */
                        ExportTraceServiceResponse.prototype.partialSuccess = null;

                        /**
                         * Encodes the specified ExportTraceServiceResponse message. Does not implicitly {@link opentelemetry.proto.collector.trace.v1.ExportTraceServiceResponse.verify|verify} messages.
                         * @function encode
                         * @memberof opentelemetry.proto.collector.trace.v1.ExportTraceServiceResponse
                         * @static
                         * @param {opentelemetry.proto.collector.trace.v1.IExportTraceServiceResponse} message ExportTraceServiceResponse message or plain object to encode
                         * @param {$protobuf.Writer} [writer] Writer to encode to
                         * @returns {$protobuf.Writer} Writer
                         */
                        ExportTraceServiceResponse.encode = function encode(message, writer, q) {
                            if (!writer)
                                writer = $Writer.create();
                            if (q === undefined)
                                q = 0;
                            if (q > $util.recursionLimit)
                                throw Error("max depth exceeded");
                            if (message.partialSuccess != null && Object.hasOwnProperty.call(message, "partialSuccess"))
                                $root.opentelemetry.proto.collector.trace.v1.ExportTracePartialSuccess.encode(message.partialSuccess, writer.uint32(/* id 1, wireType 2 =*/10).fork(), q + 1).ldelim();
                            return writer;
                        };

                        /**
                         * Decodes an ExportTraceServiceResponse message from the specified reader or buffer.
                         * @function decode
                         * @memberof opentelemetry.proto.collector.trace.v1.ExportTraceServiceResponse
                         * @static
                         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                         * @param {number} [length] Message length if known beforehand
                         * @returns {opentelemetry.proto.collector.trace.v1.ExportTraceServiceResponse} ExportTraceServiceResponse
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        ExportTraceServiceResponse.decode = function decode(reader, length, error, long) {
                            if (!(reader instanceof $Reader))
                                reader = $Reader.create(reader);
                            if (long === undefined)
                                long = 0;
                            if (long > $Reader.recursionLimit)
                                throw Error("maximum nesting depth exceeded");
                            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.opentelemetry.proto.collector.trace.v1.ExportTraceServiceResponse();
                            while (reader.pos < end) {
                                let tag = reader.uint32();
                                if (tag === error)
                                    break;
                                switch (tag >>> 3) {
                                case 1: {
                                        message.partialSuccess = $root.opentelemetry.proto.collector.trace.v1.ExportTracePartialSuccess.decode(reader, reader.uint32(), undefined, long + 1);
                                        break;
                                    }
                                default:
                                    reader.skipType(tag & 7, long);
                                    break;
                                }
                            }
                            return message;
                        };

                        /**
                         * Gets the default type url for ExportTraceServiceResponse
                         * @function getTypeUrl
                         * @memberof opentelemetry.proto.collector.trace.v1.ExportTraceServiceResponse
                         * @static
                         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns {string} The default type url
                         */
                        ExportTraceServiceResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                            if (typeUrlPrefix === undefined) {
                                typeUrlPrefix = "type.googleapis.com";
                            }
                            return typeUrlPrefix + "/opentelemetry.proto.collector.trace.v1.ExportTraceServiceResponse";
                        };

                        return ExportTraceServiceResponse;
                    })();

                    v1.ExportTracePartialSuccess = (function() {

                        /**
                         * Properties of an ExportTracePartialSuccess.
                         * @memberof opentelemetry.proto.collector.trace.v1
                         * @interface IExportTracePartialSuccess
                         * @property {number|Long|null} [rejectedSpans] ExportTracePartialSuccess rejectedSpans
                         * @property {string|null} [errorMessage] ExportTracePartialSuccess errorMessage
                         */

                        /**
                         * Constructs a new ExportTracePartialSuccess.
                         * @memberof opentelemetry.proto.collector.trace.v1
                         * @classdesc Represents an ExportTracePartialSuccess.
                         * @implements IExportTracePartialSuccess
                         * @constructor
                         * @param {opentelemetry.proto.collector.trace.v1.IExportTracePartialSuccess=} [properties] Properties to set
                         */
                        function ExportTracePartialSuccess(properties) {
                            if (properties)
                                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                        this[keys[i]] = properties[keys[i]];
                        }

                        /**
                         * ExportTracePartialSuccess rejectedSpans.
                         * @member {number|Long} rejectedSpans
                         * @memberof opentelemetry.proto.collector.trace.v1.ExportTracePartialSuccess
                         * @instance
                         */
                        ExportTracePartialSuccess.prototype.rejectedSpans = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

                        /**
                         * ExportTracePartialSuccess errorMessage.
                         * @member {string} errorMessage
                         * @memberof opentelemetry.proto.collector.trace.v1.ExportTracePartialSuccess
                         * @instance
                         */
                        ExportTracePartialSuccess.prototype.errorMessage = "";

                        /**
                         * Encodes the specified ExportTracePartialSuccess message. Does not implicitly {@link opentelemetry.proto.collector.trace.v1.ExportTracePartialSuccess.verify|verify} messages.
                         * @function encode
                         * @memberof opentelemetry.proto.collector.trace.v1.ExportTracePartialSuccess
                         * @static
                         * @param {opentelemetry.proto.collector.trace.v1.IExportTracePartialSuccess} message ExportTracePartialSuccess message or plain object to encode
                         * @param {$protobuf.Writer} [writer] Writer to encode to
                         * @returns {$protobuf.Writer} Writer
                         */
                        ExportTracePartialSuccess.encode = function encode(message, writer, q) {
                            if (!writer)
                                writer = $Writer.create();
                            if (q === undefined)
                                q = 0;
                            if (q > $util.recursionLimit)
                                throw Error("max depth exceeded");
                            if (message.rejectedSpans != null && Object.hasOwnProperty.call(message, "rejectedSpans"))
                                writer.uint32(/* id 1, wireType 0 =*/8).int64(message.rejectedSpans);
                            if (message.errorMessage != null && Object.hasOwnProperty.call(message, "errorMessage"))
                                writer.uint32(/* id 2, wireType 2 =*/18).string(message.errorMessage);
                            return writer;
                        };

                        /**
                         * Decodes an ExportTracePartialSuccess message from the specified reader or buffer.
                         * @function decode
                         * @memberof opentelemetry.proto.collector.trace.v1.ExportTracePartialSuccess
                         * @static
                         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                         * @param {number} [length] Message length if known beforehand
                         * @returns {opentelemetry.proto.collector.trace.v1.ExportTracePartialSuccess} ExportTracePartialSuccess
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        ExportTracePartialSuccess.decode = function decode(reader, length, error, long) {
                            if (!(reader instanceof $Reader))
                                reader = $Reader.create(reader);
                            if (long === undefined)
                                long = 0;
                            if (long > $Reader.recursionLimit)
                                throw Error("maximum nesting depth exceeded");
                            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.opentelemetry.proto.collector.trace.v1.ExportTracePartialSuccess();
                            while (reader.pos < end) {
                                let tag = reader.uint32();
                                if (tag === error)
                                    break;
                                switch (tag >>> 3) {
                                case 1: {
                                        message.rejectedSpans = reader.int64();
                                        break;
                                    }
                                case 2: {
                                        message.errorMessage = reader.string();
                                        break;
                                    }
                                default:
                                    reader.skipType(tag & 7, long);
                                    break;
                                }
                            }
                            return message;
                        };

                        /**
                         * Gets the default type url for ExportTracePartialSuccess
                         * @function getTypeUrl
                         * @memberof opentelemetry.proto.collector.trace.v1.ExportTracePartialSuccess
                         * @static
                         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns {string} The default type url
                         */
                        ExportTracePartialSuccess.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                            if (typeUrlPrefix === undefined) {
                                typeUrlPrefix = "type.googleapis.com";
                            }
                            return typeUrlPrefix + "/opentelemetry.proto.collector.trace.v1.ExportTracePartialSuccess";
                        };

                        return ExportTracePartialSuccess;
                    })();

                    return v1;
                })();

                return trace;
            })();

            collector.logs = (function() {

                /**
                 * Namespace logs.
                 * @memberof opentelemetry.proto.collector
                 * @namespace
                 */
                const logs = {};

                logs.v1 = (function() {

                    /**
                     * Namespace v1.
                     * @memberof opentelemetry.proto.collector.logs
                     * @namespace
                     */
                    const v1 = {};

                    v1.ExportLogsServiceRequest = (function() {

                        /**
                         * Properties of an ExportLogsServiceRequest.
                         * @memberof opentelemetry.proto.collector.logs.v1
                         * @interface IExportLogsServiceRequest
                         * @property {Array.<opentelemetry.proto.logs.v1.IResourceLogs>|null} [resourceLogs] ExportLogsServiceRequest resourceLogs
                         */

                        /**
                         * Constructs a new ExportLogsServiceRequest.
                         * @memberof opentelemetry.proto.collector.logs.v1
                         * @classdesc Represents an ExportLogsServiceRequest.
                         * @implements IExportLogsServiceRequest
                         * @constructor
                         * @param {opentelemetry.proto.collector.logs.v1.IExportLogsServiceRequest=} [properties] Properties to set
                         */
                        function ExportLogsServiceRequest(properties) {
                            this.resourceLogs = [];
                            if (properties)
                                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                        this[keys[i]] = properties[keys[i]];
                        }

                        /**
                         * ExportLogsServiceRequest resourceLogs.
                         * @member {Array.<opentelemetry.proto.logs.v1.IResourceLogs>} resourceLogs
                         * @memberof opentelemetry.proto.collector.logs.v1.ExportLogsServiceRequest
                         * @instance
                         */
                        ExportLogsServiceRequest.prototype.resourceLogs = $util.emptyArray;

                        /**
                         * Encodes the specified ExportLogsServiceRequest message. Does not implicitly {@link opentelemetry.proto.collector.logs.v1.ExportLogsServiceRequest.verify|verify} messages.
                         * @function encode
                         * @memberof opentelemetry.proto.collector.logs.v1.ExportLogsServiceRequest
                         * @static
                         * @param {opentelemetry.proto.collector.logs.v1.IExportLogsServiceRequest} message ExportLogsServiceRequest message or plain object to encode
                         * @param {$protobuf.Writer} [writer] Writer to encode to
                         * @returns {$protobuf.Writer} Writer
                         */
                        ExportLogsServiceRequest.encode = function encode(message, writer, q) {
                            if (!writer)
                                writer = $Writer.create();
                            if (q === undefined)
                                q = 0;
                            if (q > $util.recursionLimit)
                                throw Error("max depth exceeded");
                            if (message.resourceLogs != null && message.resourceLogs.length)
                                for (let i = 0; i < message.resourceLogs.length; ++i)
                                    $root.opentelemetry.proto.logs.v1.ResourceLogs.encode(message.resourceLogs[i], writer.uint32(/* id 1, wireType 2 =*/10).fork(), q + 1).ldelim();
                            return writer;
                        };

                        /**
                         * Decodes an ExportLogsServiceRequest message from the specified reader or buffer.
                         * @function decode
                         * @memberof opentelemetry.proto.collector.logs.v1.ExportLogsServiceRequest
                         * @static
                         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                         * @param {number} [length] Message length if known beforehand
                         * @returns {opentelemetry.proto.collector.logs.v1.ExportLogsServiceRequest} ExportLogsServiceRequest
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        ExportLogsServiceRequest.decode = function decode(reader, length, error, long) {
                            if (!(reader instanceof $Reader))
                                reader = $Reader.create(reader);
                            if (long === undefined)
                                long = 0;
                            if (long > $Reader.recursionLimit)
                                throw Error("maximum nesting depth exceeded");
                            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.opentelemetry.proto.collector.logs.v1.ExportLogsServiceRequest();
                            while (reader.pos < end) {
                                let tag = reader.uint32();
                                if (tag === error)
                                    break;
                                switch (tag >>> 3) {
                                case 1: {
                                        if (!(message.resourceLogs && message.resourceLogs.length))
                                            message.resourceLogs = [];
                                        message.resourceLogs.push($root.opentelemetry.proto.logs.v1.ResourceLogs.decode(reader, reader.uint32(), undefined, long + 1));
                                        break;
                                    }
                                default:
                                    reader.skipType(tag & 7, long);
                                    break;
                                }
                            }
                            return message;
                        };

                        /**
                         * Gets the default type url for ExportLogsServiceRequest
                         * @function getTypeUrl
                         * @memberof opentelemetry.proto.collector.logs.v1.ExportLogsServiceRequest
                         * @static
                         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns {string} The default type url
                         */
                        ExportLogsServiceRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                            if (typeUrlPrefix === undefined) {
                                typeUrlPrefix = "type.googleapis.com";
                            }
                            return typeUrlPrefix + "/opentelemetry.proto.collector.logs.v1.ExportLogsServiceRequest";
                        };

                        return ExportLogsServiceRequest;
                    })();

                    v1.ExportLogsServiceResponse = (function() {

                        /**
                         * Properties of an ExportLogsServiceResponse.
                         * @memberof opentelemetry.proto.collector.logs.v1
                         * @interface IExportLogsServiceResponse
                         * @property {opentelemetry.proto.collector.logs.v1.IExportLogsPartialSuccess|null} [partialSuccess] ExportLogsServiceResponse partialSuccess
                         */

                        /**
                         * Constructs a new ExportLogsServiceResponse.
                         * @memberof opentelemetry.proto.collector.logs.v1
                         * @classdesc Represents an ExportLogsServiceResponse.
                         * @implements IExportLogsServiceResponse
                         * @constructor
                         * @param {opentelemetry.proto.collector.logs.v1.IExportLogsServiceResponse=} [properties] Properties to set
                         */
                        function ExportLogsServiceResponse(properties) {
                            if (properties)
                                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                        this[keys[i]] = properties[keys[i]];
                        }

                        /**
                         * ExportLogsServiceResponse partialSuccess.
                         * @member {opentelemetry.proto.collector.logs.v1.IExportLogsPartialSuccess|null|undefined} partialSuccess
                         * @memberof opentelemetry.proto.collector.logs.v1.ExportLogsServiceResponse
                         * @instance
                         */
                        ExportLogsServiceResponse.prototype.partialSuccess = null;

                        /**
                         * Encodes the specified ExportLogsServiceResponse message. Does not implicitly {@link opentelemetry.proto.collector.logs.v1.ExportLogsServiceResponse.verify|verify} messages.
                         * @function encode
                         * @memberof opentelemetry.proto.collector.logs.v1.ExportLogsServiceResponse
                         * @static
                         * @param {opentelemetry.proto.collector.logs.v1.IExportLogsServiceResponse} message ExportLogsServiceResponse message or plain object to encode
                         * @param {$protobuf.Writer} [writer] Writer to encode to
                         * @returns {$protobuf.Writer} Writer
                         */
                        ExportLogsServiceResponse.encode = function encode(message, writer, q) {
                            if (!writer)
                                writer = $Writer.create();
                            if (q === undefined)
                                q = 0;
                            if (q > $util.recursionLimit)
                                throw Error("max depth exceeded");
                            if (message.partialSuccess != null && Object.hasOwnProperty.call(message, "partialSuccess"))
                                $root.opentelemetry.proto.collector.logs.v1.ExportLogsPartialSuccess.encode(message.partialSuccess, writer.uint32(/* id 1, wireType 2 =*/10).fork(), q + 1).ldelim();
                            return writer;
                        };

                        /**
                         * Decodes an ExportLogsServiceResponse message from the specified reader or buffer.
                         * @function decode
                         * @memberof opentelemetry.proto.collector.logs.v1.ExportLogsServiceResponse
                         * @static
                         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                         * @param {number} [length] Message length if known beforehand
                         * @returns {opentelemetry.proto.collector.logs.v1.ExportLogsServiceResponse} ExportLogsServiceResponse
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        ExportLogsServiceResponse.decode = function decode(reader, length, error, long) {
                            if (!(reader instanceof $Reader))
                                reader = $Reader.create(reader);
                            if (long === undefined)
                                long = 0;
                            if (long > $Reader.recursionLimit)
                                throw Error("maximum nesting depth exceeded");
                            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.opentelemetry.proto.collector.logs.v1.ExportLogsServiceResponse();
                            while (reader.pos < end) {
                                let tag = reader.uint32();
                                if (tag === error)
                                    break;
                                switch (tag >>> 3) {
                                case 1: {
                                        message.partialSuccess = $root.opentelemetry.proto.collector.logs.v1.ExportLogsPartialSuccess.decode(reader, reader.uint32(), undefined, long + 1);
                                        break;
                                    }
                                default:
                                    reader.skipType(tag & 7, long);
                                    break;
                                }
                            }
                            return message;
                        };

                        /**
                         * Gets the default type url for ExportLogsServiceResponse
                         * @function getTypeUrl
                         * @memberof opentelemetry.proto.collector.logs.v1.ExportLogsServiceResponse
                         * @static
                         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns {string} The default type url
                         */
                        ExportLogsServiceResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                            if (typeUrlPrefix === undefined) {
                                typeUrlPrefix = "type.googleapis.com";
                            }
                            return typeUrlPrefix + "/opentelemetry.proto.collector.logs.v1.ExportLogsServiceResponse";
                        };

                        return ExportLogsServiceResponse;
                    })();

                    v1.ExportLogsPartialSuccess = (function() {

                        /**
                         * Properties of an ExportLogsPartialSuccess.
                         * @memberof opentelemetry.proto.collector.logs.v1
                         * @interface IExportLogsPartialSuccess
                         * @property {number|Long|null} [rejectedLogRecords] ExportLogsPartialSuccess rejectedLogRecords
                         * @property {string|null} [errorMessage] ExportLogsPartialSuccess errorMessage
                         */

                        /**
                         * Constructs a new ExportLogsPartialSuccess.
                         * @memberof opentelemetry.proto.collector.logs.v1
                         * @classdesc Represents an ExportLogsPartialSuccess.
                         * @implements IExportLogsPartialSuccess
                         * @constructor
                         * @param {opentelemetry.proto.collector.logs.v1.IExportLogsPartialSuccess=} [properties] Properties to set
                         */
                        function ExportLogsPartialSuccess(properties) {
                            if (properties)
                                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                        this[keys[i]] = properties[keys[i]];
                        }

                        /**
                         * ExportLogsPartialSuccess rejectedLogRecords.
                         * @member {number|Long} rejectedLogRecords
                         * @memberof opentelemetry.proto.collector.logs.v1.ExportLogsPartialSuccess
                         * @instance
                         */
                        ExportLogsPartialSuccess.prototype.rejectedLogRecords = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

                        /**
                         * ExportLogsPartialSuccess errorMessage.
                         * @member {string} errorMessage
                         * @memberof opentelemetry.proto.collector.logs.v1.ExportLogsPartialSuccess
                         * @instance
                         */
                        ExportLogsPartialSuccess.prototype.errorMessage = "";

                        /**
                         * Encodes the specified ExportLogsPartialSuccess message. Does not implicitly {@link opentelemetry.proto.collector.logs.v1.ExportLogsPartialSuccess.verify|verify} messages.
                         * @function encode
                         * @memberof opentelemetry.proto.collector.logs.v1.ExportLogsPartialSuccess
                         * @static
                         * @param {opentelemetry.proto.collector.logs.v1.IExportLogsPartialSuccess} message ExportLogsPartialSuccess message or plain object to encode
                         * @param {$protobuf.Writer} [writer] Writer to encode to
                         * @returns {$protobuf.Writer} Writer
                         */
                        ExportLogsPartialSuccess.encode = function encode(message, writer, q) {
                            if (!writer)
                                writer = $Writer.create();
                            if (q === undefined)
                                q = 0;
                            if (q > $util.recursionLimit)
                                throw Error("max depth exceeded");
                            if (message.rejectedLogRecords != null && Object.hasOwnProperty.call(message, "rejectedLogRecords"))
                                writer.uint32(/* id 1, wireType 0 =*/8).int64(message.rejectedLogRecords);
                            if (message.errorMessage != null && Object.hasOwnProperty.call(message, "errorMessage"))
                                writer.uint32(/* id 2, wireType 2 =*/18).string(message.errorMessage);
                            return writer;
                        };

                        /**
                         * Decodes an ExportLogsPartialSuccess message from the specified reader or buffer.
                         * @function decode
                         * @memberof opentelemetry.proto.collector.logs.v1.ExportLogsPartialSuccess
                         * @static
                         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                         * @param {number} [length] Message length if known beforehand
                         * @returns {opentelemetry.proto.collector.logs.v1.ExportLogsPartialSuccess} ExportLogsPartialSuccess
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        ExportLogsPartialSuccess.decode = function decode(reader, length, error, long) {
                            if (!(reader instanceof $Reader))
                                reader = $Reader.create(reader);
                            if (long === undefined)
                                long = 0;
                            if (long > $Reader.recursionLimit)
                                throw Error("maximum nesting depth exceeded");
                            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.opentelemetry.proto.collector.logs.v1.ExportLogsPartialSuccess();
                            while (reader.pos < end) {
                                let tag = reader.uint32();
                                if (tag === error)
                                    break;
                                switch (tag >>> 3) {
                                case 1: {
                                        message.rejectedLogRecords = reader.int64();
                                        break;
                                    }
                                case 2: {
                                        message.errorMessage = reader.string();
                                        break;
                                    }
                                default:
                                    reader.skipType(tag & 7, long);
                                    break;
                                }
                            }
                            return message;
                        };

                        /**
                         * Gets the default type url for ExportLogsPartialSuccess
                         * @function getTypeUrl
                         * @memberof opentelemetry.proto.collector.logs.v1.ExportLogsPartialSuccess
                         * @static
                         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns {string} The default type url
                         */
                        ExportLogsPartialSuccess.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                            if (typeUrlPrefix === undefined) {
                                typeUrlPrefix = "type.googleapis.com";
                            }
                            return typeUrlPrefix + "/opentelemetry.proto.collector.logs.v1.ExportLogsPartialSuccess";
                        };

                        return ExportLogsPartialSuccess;
                    })();

                    return v1;
                })();

                return logs;
            })();

            return collector;
        })();

        proto.trace = (function() {

            /**
             * Namespace trace.
             * @memberof opentelemetry.proto
             * @namespace
             */
            const trace = {};

            trace.v1 = (function() {

                /**
                 * Namespace v1.
                 * @memberof opentelemetry.proto.trace
                 * @namespace
                 */
                const v1 = {};

                v1.TracesData = (function() {

                    /**
                     * Properties of a TracesData.
                     * @memberof opentelemetry.proto.trace.v1
                     * @interface ITracesData
                     * @property {Array.<opentelemetry.proto.trace.v1.IResourceSpans>|null} [resourceSpans] TracesData resourceSpans
                     */

                    /**
                     * Constructs a new TracesData.
                     * @memberof opentelemetry.proto.trace.v1
                     * @classdesc Represents a TracesData.
                     * @implements ITracesData
                     * @constructor
                     * @param {opentelemetry.proto.trace.v1.ITracesData=} [properties] Properties to set
                     */
                    function TracesData(properties) {
                        this.resourceSpans = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * TracesData resourceSpans.
                     * @member {Array.<opentelemetry.proto.trace.v1.IResourceSpans>} resourceSpans
                     * @memberof opentelemetry.proto.trace.v1.TracesData
                     * @instance
                     */
                    TracesData.prototype.resourceSpans = $util.emptyArray;

                    /**
                     * Encodes the specified TracesData message. Does not implicitly {@link opentelemetry.proto.trace.v1.TracesData.verify|verify} messages.
                     * @function encode
                     * @memberof opentelemetry.proto.trace.v1.TracesData
                     * @static
                     * @param {opentelemetry.proto.trace.v1.ITracesData} message TracesData message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    TracesData.encode = function encode(message, writer, q) {
                        if (!writer)
                            writer = $Writer.create();
                        if (q === undefined)
                            q = 0;
                        if (q > $util.recursionLimit)
                            throw Error("max depth exceeded");
                        if (message.resourceSpans != null && message.resourceSpans.length)
                            for (let i = 0; i < message.resourceSpans.length; ++i)
                                $root.opentelemetry.proto.trace.v1.ResourceSpans.encode(message.resourceSpans[i], writer.uint32(/* id 1, wireType 2 =*/10).fork(), q + 1).ldelim();
                        return writer;
                    };

                    /**
                     * Decodes a TracesData message from the specified reader or buffer.
                     * @function decode
                     * @memberof opentelemetry.proto.trace.v1.TracesData
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {opentelemetry.proto.trace.v1.TracesData} TracesData
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    TracesData.decode = function decode(reader, length, error, long) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        if (long === undefined)
                            long = 0;
                        if (long > $Reader.recursionLimit)
                            throw Error("maximum nesting depth exceeded");
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.opentelemetry.proto.trace.v1.TracesData();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    if (!(message.resourceSpans && message.resourceSpans.length))
                                        message.resourceSpans = [];
                                    message.resourceSpans.push($root.opentelemetry.proto.trace.v1.ResourceSpans.decode(reader, reader.uint32(), undefined, long + 1));
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7, long);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Gets the default type url for TracesData
                     * @function getTypeUrl
                     * @memberof opentelemetry.proto.trace.v1.TracesData
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    TracesData.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/opentelemetry.proto.trace.v1.TracesData";
                    };

                    return TracesData;
                })();

                v1.ResourceSpans = (function() {

                    /**
                     * Properties of a ResourceSpans.
                     * @memberof opentelemetry.proto.trace.v1
                     * @interface IResourceSpans
                     * @property {opentelemetry.proto.resource.v1.IResource|null} [resource] ResourceSpans resource
                     * @property {Array.<opentelemetry.proto.trace.v1.IScopeSpans>|null} [scopeSpans] ResourceSpans scopeSpans
                     * @property {string|null} [schemaUrl] ResourceSpans schemaUrl
                     */

                    /**
                     * Constructs a new ResourceSpans.
                     * @memberof opentelemetry.proto.trace.v1
                     * @classdesc Represents a ResourceSpans.
                     * @implements IResourceSpans
                     * @constructor
                     * @param {opentelemetry.proto.trace.v1.IResourceSpans=} [properties] Properties to set
                     */
                    function ResourceSpans(properties) {
                        this.scopeSpans = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * ResourceSpans resource.
                     * @member {opentelemetry.proto.resource.v1.IResource|null|undefined} resource
                     * @memberof opentelemetry.proto.trace.v1.ResourceSpans
                     * @instance
                     */
                    ResourceSpans.prototype.resource = null;

                    /**
                     * ResourceSpans scopeSpans.
                     * @member {Array.<opentelemetry.proto.trace.v1.IScopeSpans>} scopeSpans
                     * @memberof opentelemetry.proto.trace.v1.ResourceSpans
                     * @instance
                     */
                    ResourceSpans.prototype.scopeSpans = $util.emptyArray;

                    /**
                     * ResourceSpans schemaUrl.
                     * @member {string} schemaUrl
                     * @memberof opentelemetry.proto.trace.v1.ResourceSpans
                     * @instance
                     */
                    ResourceSpans.prototype.schemaUrl = "";

                    /**
                     * Encodes the specified ResourceSpans message. Does not implicitly {@link opentelemetry.proto.trace.v1.ResourceSpans.verify|verify} messages.
                     * @function encode
                     * @memberof opentelemetry.proto.trace.v1.ResourceSpans
                     * @static
                     * @param {opentelemetry.proto.trace.v1.IResourceSpans} message ResourceSpans message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ResourceSpans.encode = function encode(message, writer, q) {
                        if (!writer)
                            writer = $Writer.create();
                        if (q === undefined)
                            q = 0;
                        if (q > $util.recursionLimit)
                            throw Error("max depth exceeded");
                        if (message.resource != null && Object.hasOwnProperty.call(message, "resource"))
                            $root.opentelemetry.proto.resource.v1.Resource.encode(message.resource, writer.uint32(/* id 1, wireType 2 =*/10).fork(), q + 1).ldelim();
                        if (message.scopeSpans != null && message.scopeSpans.length)
                            for (let i = 0; i < message.scopeSpans.length; ++i)
                                $root.opentelemetry.proto.trace.v1.ScopeSpans.encode(message.scopeSpans[i], writer.uint32(/* id 2, wireType 2 =*/18).fork(), q + 1).ldelim();
                        if (message.schemaUrl != null && Object.hasOwnProperty.call(message, "schemaUrl"))
                            writer.uint32(/* id 3, wireType 2 =*/26).string(message.schemaUrl);
                        return writer;
                    };

                    /**
                     * Decodes a ResourceSpans message from the specified reader or buffer.
                     * @function decode
                     * @memberof opentelemetry.proto.trace.v1.ResourceSpans
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {opentelemetry.proto.trace.v1.ResourceSpans} ResourceSpans
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ResourceSpans.decode = function decode(reader, length, error, long) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        if (long === undefined)
                            long = 0;
                        if (long > $Reader.recursionLimit)
                            throw Error("maximum nesting depth exceeded");
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.opentelemetry.proto.trace.v1.ResourceSpans();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.resource = $root.opentelemetry.proto.resource.v1.Resource.decode(reader, reader.uint32(), undefined, long + 1);
                                    break;
                                }
                            case 2: {
                                    if (!(message.scopeSpans && message.scopeSpans.length))
                                        message.scopeSpans = [];
                                    message.scopeSpans.push($root.opentelemetry.proto.trace.v1.ScopeSpans.decode(reader, reader.uint32(), undefined, long + 1));
                                    break;
                                }
                            case 3: {
                                    message.schemaUrl = reader.string();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7, long);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Gets the default type url for ResourceSpans
                     * @function getTypeUrl
                     * @memberof opentelemetry.proto.trace.v1.ResourceSpans
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    ResourceSpans.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/opentelemetry.proto.trace.v1.ResourceSpans";
                    };

                    return ResourceSpans;
                })();

                v1.ScopeSpans = (function() {

                    /**
                     * Properties of a ScopeSpans.
                     * @memberof opentelemetry.proto.trace.v1
                     * @interface IScopeSpans
                     * @property {opentelemetry.proto.common.v1.IInstrumentationScope|null} [scope] ScopeSpans scope
                     * @property {Array.<opentelemetry.proto.trace.v1.ISpan>|null} [spans] ScopeSpans spans
                     * @property {string|null} [schemaUrl] ScopeSpans schemaUrl
                     */

                    /**
                     * Constructs a new ScopeSpans.
                     * @memberof opentelemetry.proto.trace.v1
                     * @classdesc Represents a ScopeSpans.
                     * @implements IScopeSpans
                     * @constructor
                     * @param {opentelemetry.proto.trace.v1.IScopeSpans=} [properties] Properties to set
                     */
                    function ScopeSpans(properties) {
                        this.spans = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * ScopeSpans scope.
                     * @member {opentelemetry.proto.common.v1.IInstrumentationScope|null|undefined} scope
                     * @memberof opentelemetry.proto.trace.v1.ScopeSpans
                     * @instance
                     */
                    ScopeSpans.prototype.scope = null;

                    /**
                     * ScopeSpans spans.
                     * @member {Array.<opentelemetry.proto.trace.v1.ISpan>} spans
                     * @memberof opentelemetry.proto.trace.v1.ScopeSpans
                     * @instance
                     */
                    ScopeSpans.prototype.spans = $util.emptyArray;

                    /**
                     * ScopeSpans schemaUrl.
                     * @member {string} schemaUrl
                     * @memberof opentelemetry.proto.trace.v1.ScopeSpans
                     * @instance
                     */
                    ScopeSpans.prototype.schemaUrl = "";

                    /**
                     * Encodes the specified ScopeSpans message. Does not implicitly {@link opentelemetry.proto.trace.v1.ScopeSpans.verify|verify} messages.
                     * @function encode
                     * @memberof opentelemetry.proto.trace.v1.ScopeSpans
                     * @static
                     * @param {opentelemetry.proto.trace.v1.IScopeSpans} message ScopeSpans message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ScopeSpans.encode = function encode(message, writer, q) {
                        if (!writer)
                            writer = $Writer.create();
                        if (q === undefined)
                            q = 0;
                        if (q > $util.recursionLimit)
                            throw Error("max depth exceeded");
                        if (message.scope != null && Object.hasOwnProperty.call(message, "scope"))
                            $root.opentelemetry.proto.common.v1.InstrumentationScope.encode(message.scope, writer.uint32(/* id 1, wireType 2 =*/10).fork(), q + 1).ldelim();
                        if (message.spans != null && message.spans.length)
                            for (let i = 0; i < message.spans.length; ++i)
                                $root.opentelemetry.proto.trace.v1.Span.encode(message.spans[i], writer.uint32(/* id 2, wireType 2 =*/18).fork(), q + 1).ldelim();
                        if (message.schemaUrl != null && Object.hasOwnProperty.call(message, "schemaUrl"))
                            writer.uint32(/* id 3, wireType 2 =*/26).string(message.schemaUrl);
                        return writer;
                    };

                    /**
                     * Decodes a ScopeSpans message from the specified reader or buffer.
                     * @function decode
                     * @memberof opentelemetry.proto.trace.v1.ScopeSpans
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {opentelemetry.proto.trace.v1.ScopeSpans} ScopeSpans
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ScopeSpans.decode = function decode(reader, length, error, long) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        if (long === undefined)
                            long = 0;
                        if (long > $Reader.recursionLimit)
                            throw Error("maximum nesting depth exceeded");
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.opentelemetry.proto.trace.v1.ScopeSpans();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.scope = $root.opentelemetry.proto.common.v1.InstrumentationScope.decode(reader, reader.uint32(), undefined, long + 1);
                                    break;
                                }
                            case 2: {
                                    if (!(message.spans && message.spans.length))
                                        message.spans = [];
                                    message.spans.push($root.opentelemetry.proto.trace.v1.Span.decode(reader, reader.uint32(), undefined, long + 1));
                                    break;
                                }
                            case 3: {
                                    message.schemaUrl = reader.string();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7, long);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Gets the default type url for ScopeSpans
                     * @function getTypeUrl
                     * @memberof opentelemetry.proto.trace.v1.ScopeSpans
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    ScopeSpans.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/opentelemetry.proto.trace.v1.ScopeSpans";
                    };

                    return ScopeSpans;
                })();

                v1.Span = (function() {

                    /**
                     * Properties of a Span.
                     * @memberof opentelemetry.proto.trace.v1
                     * @interface ISpan
                     * @property {Uint8Array|null} [traceId] Span traceId
                     * @property {Uint8Array|null} [spanId] Span spanId
                     * @property {string|null} [traceState] Span traceState
                     * @property {Uint8Array|null} [parentSpanId] Span parentSpanId
                     * @property {number|null} [flags] Span flags
                     * @property {string|null} [name] Span name
                     * @property {opentelemetry.proto.trace.v1.Span.SpanKind|null} [kind] Span kind
                     * @property {number|Long|null} [startTimeUnixNano] Span startTimeUnixNano
                     * @property {number|Long|null} [endTimeUnixNano] Span endTimeUnixNano
                     * @property {Array.<opentelemetry.proto.common.v1.IKeyValue>|null} [attributes] Span attributes
                     * @property {number|null} [droppedAttributesCount] Span droppedAttributesCount
                     * @property {Array.<opentelemetry.proto.trace.v1.Span.IEvent>|null} [events] Span events
                     * @property {number|null} [droppedEventsCount] Span droppedEventsCount
                     * @property {Array.<opentelemetry.proto.trace.v1.Span.ILink>|null} [links] Span links
                     * @property {number|null} [droppedLinksCount] Span droppedLinksCount
                     * @property {opentelemetry.proto.trace.v1.IStatus|null} [status] Span status
                     */

                    /**
                     * Constructs a new Span.
                     * @memberof opentelemetry.proto.trace.v1
                     * @classdesc Represents a Span.
                     * @implements ISpan
                     * @constructor
                     * @param {opentelemetry.proto.trace.v1.ISpan=} [properties] Properties to set
                     */
                    function Span(properties) {
                        this.attributes = [];
                        this.events = [];
                        this.links = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * Span traceId.
                     * @member {Uint8Array} traceId
                     * @memberof opentelemetry.proto.trace.v1.Span
                     * @instance
                     */
                    Span.prototype.traceId = $util.newBuffer([]);

                    /**
                     * Span spanId.
                     * @member {Uint8Array} spanId
                     * @memberof opentelemetry.proto.trace.v1.Span
                     * @instance
                     */
                    Span.prototype.spanId = $util.newBuffer([]);

                    /**
                     * Span traceState.
                     * @member {string} traceState
                     * @memberof opentelemetry.proto.trace.v1.Span
                     * @instance
                     */
                    Span.prototype.traceState = "";

                    /**
                     * Span parentSpanId.
                     * @member {Uint8Array} parentSpanId
                     * @memberof opentelemetry.proto.trace.v1.Span
                     * @instance
                     */
                    Span.prototype.parentSpanId = $util.newBuffer([]);

                    /**
                     * Span flags.
                     * @member {number} flags
                     * @memberof opentelemetry.proto.trace.v1.Span
                     * @instance
                     */
                    Span.prototype.flags = 0;

                    /**
                     * Span name.
                     * @member {string} name
                     * @memberof opentelemetry.proto.trace.v1.Span
                     * @instance
                     */
                    Span.prototype.name = "";

                    /**
                     * Span kind.
                     * @member {opentelemetry.proto.trace.v1.Span.SpanKind} kind
                     * @memberof opentelemetry.proto.trace.v1.Span
                     * @instance
                     */
                    Span.prototype.kind = 0;

                    /**
                     * Span startTimeUnixNano.
                     * @member {number|Long} startTimeUnixNano
                     * @memberof opentelemetry.proto.trace.v1.Span
                     * @instance
                     */
                    Span.prototype.startTimeUnixNano = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

                    /**
                     * Span endTimeUnixNano.
                     * @member {number|Long} endTimeUnixNano
                     * @memberof opentelemetry.proto.trace.v1.Span
                     * @instance
                     */
                    Span.prototype.endTimeUnixNano = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

                    /**
                     * Span attributes.
                     * @member {Array.<opentelemetry.proto.common.v1.IKeyValue>} attributes
                     * @memberof opentelemetry.proto.trace.v1.Span
                     * @instance
                     */
                    Span.prototype.attributes = $util.emptyArray;

                    /**
                     * Span droppedAttributesCount.
                     * @member {number} droppedAttributesCount
                     * @memberof opentelemetry.proto.trace.v1.Span
                     * @instance
                     */
                    Span.prototype.droppedAttributesCount = 0;

                    /**
                     * Span events.
                     * @member {Array.<opentelemetry.proto.trace.v1.Span.IEvent>} events
                     * @memberof opentelemetry.proto.trace.v1.Span
                     * @instance
                     */
                    Span.prototype.events = $util.emptyArray;

                    /**
                     * Span droppedEventsCount.
                     * @member {number} droppedEventsCount
                     * @memberof opentelemetry.proto.trace.v1.Span
                     * @instance
                     */
                    Span.prototype.droppedEventsCount = 0;

                    /**
                     * Span links.
                     * @member {Array.<opentelemetry.proto.trace.v1.Span.ILink>} links
                     * @memberof opentelemetry.proto.trace.v1.Span
                     * @instance
                     */
                    Span.prototype.links = $util.emptyArray;

                    /**
                     * Span droppedLinksCount.
                     * @member {number} droppedLinksCount
                     * @memberof opentelemetry.proto.trace.v1.Span
                     * @instance
                     */
                    Span.prototype.droppedLinksCount = 0;

                    /**
                     * Span status.
                     * @member {opentelemetry.proto.trace.v1.IStatus|null|undefined} status
                     * @memberof opentelemetry.proto.trace.v1.Span
                     * @instance
                     */
                    Span.prototype.status = null;

                    /**
                     * Encodes the specified Span message. Does not implicitly {@link opentelemetry.proto.trace.v1.Span.verify|verify} messages.
                     * @function encode
                     * @memberof opentelemetry.proto.trace.v1.Span
                     * @static
                     * @param {opentelemetry.proto.trace.v1.ISpan} message Span message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Span.encode = function encode(message, writer, q) {
                        if (!writer)
                            writer = $Writer.create();
                        if (q === undefined)
                            q = 0;
                        if (q > $util.recursionLimit)
                            throw Error("max depth exceeded");
                        if (message.traceId != null && Object.hasOwnProperty.call(message, "traceId"))
                            writer.uint32(/* id 1, wireType 2 =*/10).bytes(message.traceId);
                        if (message.spanId != null && Object.hasOwnProperty.call(message, "spanId"))
                            writer.uint32(/* id 2, wireType 2 =*/18).bytes(message.spanId);
                        if (message.traceState != null && Object.hasOwnProperty.call(message, "traceState"))
                            writer.uint32(/* id 3, wireType 2 =*/26).string(message.traceState);
                        if (message.parentSpanId != null && Object.hasOwnProperty.call(message, "parentSpanId"))
                            writer.uint32(/* id 4, wireType 2 =*/34).bytes(message.parentSpanId);
                        if (message.name != null && Object.hasOwnProperty.call(message, "name"))
                            writer.uint32(/* id 5, wireType 2 =*/42).string(message.name);
                        if (message.kind != null && Object.hasOwnProperty.call(message, "kind"))
                            writer.uint32(/* id 6, wireType 0 =*/48).int32(message.kind);
                        if (message.startTimeUnixNano != null && Object.hasOwnProperty.call(message, "startTimeUnixNano"))
                            writer.uint32(/* id 7, wireType 1 =*/57).fixed64(message.startTimeUnixNano);
                        if (message.endTimeUnixNano != null && Object.hasOwnProperty.call(message, "endTimeUnixNano"))
                            writer.uint32(/* id 8, wireType 1 =*/65).fixed64(message.endTimeUnixNano);
                        if (message.attributes != null && message.attributes.length)
                            for (let i = 0; i < message.attributes.length; ++i)
                                $root.opentelemetry.proto.common.v1.KeyValue.encode(message.attributes[i], writer.uint32(/* id 9, wireType 2 =*/74).fork(), q + 1).ldelim();
                        if (message.droppedAttributesCount != null && Object.hasOwnProperty.call(message, "droppedAttributesCount"))
                            writer.uint32(/* id 10, wireType 0 =*/80).uint32(message.droppedAttributesCount);
                        if (message.events != null && message.events.length)
                            for (let i = 0; i < message.events.length; ++i)
                                $root.opentelemetry.proto.trace.v1.Span.Event.encode(message.events[i], writer.uint32(/* id 11, wireType 2 =*/90).fork(), q + 1).ldelim();
                        if (message.droppedEventsCount != null && Object.hasOwnProperty.call(message, "droppedEventsCount"))
                            writer.uint32(/* id 12, wireType 0 =*/96).uint32(message.droppedEventsCount);
                        if (message.links != null && message.links.length)
                            for (let i = 0; i < message.links.length; ++i)
                                $root.opentelemetry.proto.trace.v1.Span.Link.encode(message.links[i], writer.uint32(/* id 13, wireType 2 =*/106).fork(), q + 1).ldelim();
                        if (message.droppedLinksCount != null && Object.hasOwnProperty.call(message, "droppedLinksCount"))
                            writer.uint32(/* id 14, wireType 0 =*/112).uint32(message.droppedLinksCount);
                        if (message.status != null && Object.hasOwnProperty.call(message, "status"))
                            $root.opentelemetry.proto.trace.v1.Status.encode(message.status, writer.uint32(/* id 15, wireType 2 =*/122).fork(), q + 1).ldelim();
                        if (message.flags != null && Object.hasOwnProperty.call(message, "flags"))
                            writer.uint32(/* id 16, wireType 5 =*/133).fixed32(message.flags);
                        return writer;
                    };

                    /**
                     * Decodes a Span message from the specified reader or buffer.
                     * @function decode
                     * @memberof opentelemetry.proto.trace.v1.Span
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {opentelemetry.proto.trace.v1.Span} Span
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Span.decode = function decode(reader, length, error, long) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        if (long === undefined)
                            long = 0;
                        if (long > $Reader.recursionLimit)
                            throw Error("maximum nesting depth exceeded");
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.opentelemetry.proto.trace.v1.Span();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.traceId = reader.bytes();
                                    break;
                                }
                            case 2: {
                                    message.spanId = reader.bytes();
                                    break;
                                }
                            case 3: {
                                    message.traceState = reader.string();
                                    break;
                                }
                            case 4: {
                                    message.parentSpanId = reader.bytes();
                                    break;
                                }
                            case 16: {
                                    message.flags = reader.fixed32();
                                    break;
                                }
                            case 5: {
                                    message.name = reader.string();
                                    break;
                                }
                            case 6: {
                                    message.kind = reader.int32();
                                    break;
                                }
                            case 7: {
                                    message.startTimeUnixNano = reader.fixed64();
                                    break;
                                }
                            case 8: {
                                    message.endTimeUnixNano = reader.fixed64();
                                    break;
                                }
                            case 9: {
                                    if (!(message.attributes && message.attributes.length))
                                        message.attributes = [];
                                    message.attributes.push($root.opentelemetry.proto.common.v1.KeyValue.decode(reader, reader.uint32(), undefined, long + 1));
                                    break;
                                }
                            case 10: {
                                    message.droppedAttributesCount = reader.uint32();
                                    break;
                                }
                            case 11: {
                                    if (!(message.events && message.events.length))
                                        message.events = [];
                                    message.events.push($root.opentelemetry.proto.trace.v1.Span.Event.decode(reader, reader.uint32(), undefined, long + 1));
                                    break;
                                }
                            case 12: {
                                    message.droppedEventsCount = reader.uint32();
                                    break;
                                }
                            case 13: {
                                    if (!(message.links && message.links.length))
                                        message.links = [];
                                    message.links.push($root.opentelemetry.proto.trace.v1.Span.Link.decode(reader, reader.uint32(), undefined, long + 1));
                                    break;
                                }
                            case 14: {
                                    message.droppedLinksCount = reader.uint32();
                                    break;
                                }
                            case 15: {
                                    message.status = $root.opentelemetry.proto.trace.v1.Status.decode(reader, reader.uint32(), undefined, long + 1);
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7, long);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Gets the default type url for Span
                     * @function getTypeUrl
                     * @memberof opentelemetry.proto.trace.v1.Span
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    Span.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/opentelemetry.proto.trace.v1.Span";
                    };

                    /**
                     * SpanKind enum.
                     * @name opentelemetry.proto.trace.v1.Span.SpanKind
                     * @enum {number}
                     * @property {number} SPAN_KIND_UNSPECIFIED=0 SPAN_KIND_UNSPECIFIED value
                     * @property {number} SPAN_KIND_INTERNAL=1 SPAN_KIND_INTERNAL value
                     * @property {number} SPAN_KIND_SERVER=2 SPAN_KIND_SERVER value
                     * @property {number} SPAN_KIND_CLIENT=3 SPAN_KIND_CLIENT value
                     * @property {number} SPAN_KIND_PRODUCER=4 SPAN_KIND_PRODUCER value
                     * @property {number} SPAN_KIND_CONSUMER=5 SPAN_KIND_CONSUMER value
                     */
                    Span.SpanKind = (function() {
                        const valuesById = {}, values = Object.create(valuesById);
                        values[valuesById[0] = "SPAN_KIND_UNSPECIFIED"] = 0;
                        values[valuesById[1] = "SPAN_KIND_INTERNAL"] = 1;
                        values[valuesById[2] = "SPAN_KIND_SERVER"] = 2;
                        values[valuesById[3] = "SPAN_KIND_CLIENT"] = 3;
                        values[valuesById[4] = "SPAN_KIND_PRODUCER"] = 4;
                        values[valuesById[5] = "SPAN_KIND_CONSUMER"] = 5;
                        return values;
                    })();

                    Span.Event = (function() {

                        /**
                         * Properties of an Event.
                         * @memberof opentelemetry.proto.trace.v1.Span
                         * @interface IEvent
                         * @property {number|Long|null} [timeUnixNano] Event timeUnixNano
                         * @property {string|null} [name] Event name
                         * @property {Array.<opentelemetry.proto.common.v1.IKeyValue>|null} [attributes] Event attributes
                         * @property {number|null} [droppedAttributesCount] Event droppedAttributesCount
                         */

                        /**
                         * Constructs a new Event.
                         * @memberof opentelemetry.proto.trace.v1.Span
                         * @classdesc Represents an Event.
                         * @implements IEvent
                         * @constructor
                         * @param {opentelemetry.proto.trace.v1.Span.IEvent=} [properties] Properties to set
                         */
                        function Event(properties) {
                            this.attributes = [];
                            if (properties)
                                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                        this[keys[i]] = properties[keys[i]];
                        }

                        /**
                         * Event timeUnixNano.
                         * @member {number|Long} timeUnixNano
                         * @memberof opentelemetry.proto.trace.v1.Span.Event
                         * @instance
                         */
                        Event.prototype.timeUnixNano = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

                        /**
                         * Event name.
                         * @member {string} name
                         * @memberof opentelemetry.proto.trace.v1.Span.Event
                         * @instance
                         */
                        Event.prototype.name = "";

                        /**
                         * Event attributes.
                         * @member {Array.<opentelemetry.proto.common.v1.IKeyValue>} attributes
                         * @memberof opentelemetry.proto.trace.v1.Span.Event
                         * @instance
                         */
                        Event.prototype.attributes = $util.emptyArray;

                        /**
                         * Event droppedAttributesCount.
                         * @member {number} droppedAttributesCount
                         * @memberof opentelemetry.proto.trace.v1.Span.Event
                         * @instance
                         */
                        Event.prototype.droppedAttributesCount = 0;

                        /**
                         * Encodes the specified Event message. Does not implicitly {@link opentelemetry.proto.trace.v1.Span.Event.verify|verify} messages.
                         * @function encode
                         * @memberof opentelemetry.proto.trace.v1.Span.Event
                         * @static
                         * @param {opentelemetry.proto.trace.v1.Span.IEvent} message Event message or plain object to encode
                         * @param {$protobuf.Writer} [writer] Writer to encode to
                         * @returns {$protobuf.Writer} Writer
                         */
                        Event.encode = function encode(message, writer, q) {
                            if (!writer)
                                writer = $Writer.create();
                            if (q === undefined)
                                q = 0;
                            if (q > $util.recursionLimit)
                                throw Error("max depth exceeded");
                            if (message.timeUnixNano != null && Object.hasOwnProperty.call(message, "timeUnixNano"))
                                writer.uint32(/* id 1, wireType 1 =*/9).fixed64(message.timeUnixNano);
                            if (message.name != null && Object.hasOwnProperty.call(message, "name"))
                                writer.uint32(/* id 2, wireType 2 =*/18).string(message.name);
                            if (message.attributes != null && message.attributes.length)
                                for (let i = 0; i < message.attributes.length; ++i)
                                    $root.opentelemetry.proto.common.v1.KeyValue.encode(message.attributes[i], writer.uint32(/* id 3, wireType 2 =*/26).fork(), q + 1).ldelim();
                            if (message.droppedAttributesCount != null && Object.hasOwnProperty.call(message, "droppedAttributesCount"))
                                writer.uint32(/* id 4, wireType 0 =*/32).uint32(message.droppedAttributesCount);
                            return writer;
                        };

                        /**
                         * Decodes an Event message from the specified reader or buffer.
                         * @function decode
                         * @memberof opentelemetry.proto.trace.v1.Span.Event
                         * @static
                         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                         * @param {number} [length] Message length if known beforehand
                         * @returns {opentelemetry.proto.trace.v1.Span.Event} Event
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        Event.decode = function decode(reader, length, error, long) {
                            if (!(reader instanceof $Reader))
                                reader = $Reader.create(reader);
                            if (long === undefined)
                                long = 0;
                            if (long > $Reader.recursionLimit)
                                throw Error("maximum nesting depth exceeded");
                            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.opentelemetry.proto.trace.v1.Span.Event();
                            while (reader.pos < end) {
                                let tag = reader.uint32();
                                if (tag === error)
                                    break;
                                switch (tag >>> 3) {
                                case 1: {
                                        message.timeUnixNano = reader.fixed64();
                                        break;
                                    }
                                case 2: {
                                        message.name = reader.string();
                                        break;
                                    }
                                case 3: {
                                        if (!(message.attributes && message.attributes.length))
                                            message.attributes = [];
                                        message.attributes.push($root.opentelemetry.proto.common.v1.KeyValue.decode(reader, reader.uint32(), undefined, long + 1));
                                        break;
                                    }
                                case 4: {
                                        message.droppedAttributesCount = reader.uint32();
                                        break;
                                    }
                                default:
                                    reader.skipType(tag & 7, long);
                                    break;
                                }
                            }
                            return message;
                        };

                        /**
                         * Gets the default type url for Event
                         * @function getTypeUrl
                         * @memberof opentelemetry.proto.trace.v1.Span.Event
                         * @static
                         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns {string} The default type url
                         */
                        Event.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                            if (typeUrlPrefix === undefined) {
                                typeUrlPrefix = "type.googleapis.com";
                            }
                            return typeUrlPrefix + "/opentelemetry.proto.trace.v1.Span.Event";
                        };

                        return Event;
                    })();

                    Span.Link = (function() {

                        /**
                         * Properties of a Link.
                         * @memberof opentelemetry.proto.trace.v1.Span
                         * @interface ILink
                         * @property {Uint8Array|null} [traceId] Link traceId
                         * @property {Uint8Array|null} [spanId] Link spanId
                         * @property {string|null} [traceState] Link traceState
                         * @property {Array.<opentelemetry.proto.common.v1.IKeyValue>|null} [attributes] Link attributes
                         * @property {number|null} [droppedAttributesCount] Link droppedAttributesCount
                         * @property {number|null} [flags] Link flags
                         */

                        /**
                         * Constructs a new Link.
                         * @memberof opentelemetry.proto.trace.v1.Span
                         * @classdesc Represents a Link.
                         * @implements ILink
                         * @constructor
                         * @param {opentelemetry.proto.trace.v1.Span.ILink=} [properties] Properties to set
                         */
                        function Link(properties) {
                            this.attributes = [];
                            if (properties)
                                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                        this[keys[i]] = properties[keys[i]];
                        }

                        /**
                         * Link traceId.
                         * @member {Uint8Array} traceId
                         * @memberof opentelemetry.proto.trace.v1.Span.Link
                         * @instance
                         */
                        Link.prototype.traceId = $util.newBuffer([]);

                        /**
                         * Link spanId.
                         * @member {Uint8Array} spanId
                         * @memberof opentelemetry.proto.trace.v1.Span.Link
                         * @instance
                         */
                        Link.prototype.spanId = $util.newBuffer([]);

                        /**
                         * Link traceState.
                         * @member {string} traceState
                         * @memberof opentelemetry.proto.trace.v1.Span.Link
                         * @instance
                         */
                        Link.prototype.traceState = "";

                        /**
                         * Link attributes.
                         * @member {Array.<opentelemetry.proto.common.v1.IKeyValue>} attributes
                         * @memberof opentelemetry.proto.trace.v1.Span.Link
                         * @instance
                         */
                        Link.prototype.attributes = $util.emptyArray;

                        /**
                         * Link droppedAttributesCount.
                         * @member {number} droppedAttributesCount
                         * @memberof opentelemetry.proto.trace.v1.Span.Link
                         * @instance
                         */
                        Link.prototype.droppedAttributesCount = 0;

                        /**
                         * Link flags.
                         * @member {number} flags
                         * @memberof opentelemetry.proto.trace.v1.Span.Link
                         * @instance
                         */
                        Link.prototype.flags = 0;

                        /**
                         * Encodes the specified Link message. Does not implicitly {@link opentelemetry.proto.trace.v1.Span.Link.verify|verify} messages.
                         * @function encode
                         * @memberof opentelemetry.proto.trace.v1.Span.Link
                         * @static
                         * @param {opentelemetry.proto.trace.v1.Span.ILink} message Link message or plain object to encode
                         * @param {$protobuf.Writer} [writer] Writer to encode to
                         * @returns {$protobuf.Writer} Writer
                         */
                        Link.encode = function encode(message, writer, q) {
                            if (!writer)
                                writer = $Writer.create();
                            if (q === undefined)
                                q = 0;
                            if (q > $util.recursionLimit)
                                throw Error("max depth exceeded");
                            if (message.traceId != null && Object.hasOwnProperty.call(message, "traceId"))
                                writer.uint32(/* id 1, wireType 2 =*/10).bytes(message.traceId);
                            if (message.spanId != null && Object.hasOwnProperty.call(message, "spanId"))
                                writer.uint32(/* id 2, wireType 2 =*/18).bytes(message.spanId);
                            if (message.traceState != null && Object.hasOwnProperty.call(message, "traceState"))
                                writer.uint32(/* id 3, wireType 2 =*/26).string(message.traceState);
                            if (message.attributes != null && message.attributes.length)
                                for (let i = 0; i < message.attributes.length; ++i)
                                    $root.opentelemetry.proto.common.v1.KeyValue.encode(message.attributes[i], writer.uint32(/* id 4, wireType 2 =*/34).fork(), q + 1).ldelim();
                            if (message.droppedAttributesCount != null && Object.hasOwnProperty.call(message, "droppedAttributesCount"))
                                writer.uint32(/* id 5, wireType 0 =*/40).uint32(message.droppedAttributesCount);
                            if (message.flags != null && Object.hasOwnProperty.call(message, "flags"))
                                writer.uint32(/* id 6, wireType 5 =*/53).fixed32(message.flags);
                            return writer;
                        };

                        /**
                         * Decodes a Link message from the specified reader or buffer.
                         * @function decode
                         * @memberof opentelemetry.proto.trace.v1.Span.Link
                         * @static
                         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                         * @param {number} [length] Message length if known beforehand
                         * @returns {opentelemetry.proto.trace.v1.Span.Link} Link
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        Link.decode = function decode(reader, length, error, long) {
                            if (!(reader instanceof $Reader))
                                reader = $Reader.create(reader);
                            if (long === undefined)
                                long = 0;
                            if (long > $Reader.recursionLimit)
                                throw Error("maximum nesting depth exceeded");
                            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.opentelemetry.proto.trace.v1.Span.Link();
                            while (reader.pos < end) {
                                let tag = reader.uint32();
                                if (tag === error)
                                    break;
                                switch (tag >>> 3) {
                                case 1: {
                                        message.traceId = reader.bytes();
                                        break;
                                    }
                                case 2: {
                                        message.spanId = reader.bytes();
                                        break;
                                    }
                                case 3: {
                                        message.traceState = reader.string();
                                        break;
                                    }
                                case 4: {
                                        if (!(message.attributes && message.attributes.length))
                                            message.attributes = [];
                                        message.attributes.push($root.opentelemetry.proto.common.v1.KeyValue.decode(reader, reader.uint32(), undefined, long + 1));
                                        break;
                                    }
                                case 5: {
                                        message.droppedAttributesCount = reader.uint32();
                                        break;
                                    }
                                case 6: {
                                        message.flags = reader.fixed32();
                                        break;
                                    }
                                default:
                                    reader.skipType(tag & 7, long);
                                    break;
                                }
                            }
                            return message;
                        };

                        /**
                         * Gets the default type url for Link
                         * @function getTypeUrl
                         * @memberof opentelemetry.proto.trace.v1.Span.Link
                         * @static
                         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns {string} The default type url
                         */
                        Link.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                            if (typeUrlPrefix === undefined) {
                                typeUrlPrefix = "type.googleapis.com";
                            }
                            return typeUrlPrefix + "/opentelemetry.proto.trace.v1.Span.Link";
                        };

                        return Link;
                    })();

                    return Span;
                })();

                v1.Status = (function() {

                    /**
                     * Properties of a Status.
                     * @memberof opentelemetry.proto.trace.v1
                     * @interface IStatus
                     * @property {string|null} [message] Status message
                     * @property {opentelemetry.proto.trace.v1.Status.StatusCode|null} [code] Status code
                     */

                    /**
                     * Constructs a new Status.
                     * @memberof opentelemetry.proto.trace.v1
                     * @classdesc Represents a Status.
                     * @implements IStatus
                     * @constructor
                     * @param {opentelemetry.proto.trace.v1.IStatus=} [properties] Properties to set
                     */
                    function Status(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * Status message.
                     * @member {string} message
                     * @memberof opentelemetry.proto.trace.v1.Status
                     * @instance
                     */
                    Status.prototype.message = "";

                    /**
                     * Status code.
                     * @member {opentelemetry.proto.trace.v1.Status.StatusCode} code
                     * @memberof opentelemetry.proto.trace.v1.Status
                     * @instance
                     */
                    Status.prototype.code = 0;

                    /**
                     * Encodes the specified Status message. Does not implicitly {@link opentelemetry.proto.trace.v1.Status.verify|verify} messages.
                     * @function encode
                     * @memberof opentelemetry.proto.trace.v1.Status
                     * @static
                     * @param {opentelemetry.proto.trace.v1.IStatus} message Status message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Status.encode = function encode(message, writer, q) {
                        if (!writer)
                            writer = $Writer.create();
                        if (q === undefined)
                            q = 0;
                        if (q > $util.recursionLimit)
                            throw Error("max depth exceeded");
                        if (message.message != null && Object.hasOwnProperty.call(message, "message"))
                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.message);
                        if (message.code != null && Object.hasOwnProperty.call(message, "code"))
                            writer.uint32(/* id 3, wireType 0 =*/24).int32(message.code);
                        return writer;
                    };

                    /**
                     * Decodes a Status message from the specified reader or buffer.
                     * @function decode
                     * @memberof opentelemetry.proto.trace.v1.Status
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {opentelemetry.proto.trace.v1.Status} Status
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Status.decode = function decode(reader, length, error, long) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        if (long === undefined)
                            long = 0;
                        if (long > $Reader.recursionLimit)
                            throw Error("maximum nesting depth exceeded");
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.opentelemetry.proto.trace.v1.Status();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 2: {
                                    message.message = reader.string();
                                    break;
                                }
                            case 3: {
                                    message.code = reader.int32();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7, long);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Gets the default type url for Status
                     * @function getTypeUrl
                     * @memberof opentelemetry.proto.trace.v1.Status
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    Status.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/opentelemetry.proto.trace.v1.Status";
                    };

                    /**
                     * StatusCode enum.
                     * @name opentelemetry.proto.trace.v1.Status.StatusCode
                     * @enum {number}
                     * @property {number} STATUS_CODE_UNSET=0 STATUS_CODE_UNSET value
                     * @property {number} STATUS_CODE_OK=1 STATUS_CODE_OK value
                     * @property {number} STATUS_CODE_ERROR=2 STATUS_CODE_ERROR value
                     */
                    Status.StatusCode = (function() {
                        const valuesById = {}, values = Object.create(valuesById);
                        values[valuesById[0] = "STATUS_CODE_UNSET"] = 0;
                        values[valuesById[1] = "STATUS_CODE_OK"] = 1;
                        values[valuesById[2] = "STATUS_CODE_ERROR"] = 2;
                        return values;
                    })();

                    return Status;
                })();

                /**
                 * SpanFlags enum.
                 * @name opentelemetry.proto.trace.v1.SpanFlags
                 * @enum {number}
                 * @property {number} SPAN_FLAGS_DO_NOT_USE=0 SPAN_FLAGS_DO_NOT_USE value
                 * @property {number} SPAN_FLAGS_TRACE_FLAGS_MASK=255 SPAN_FLAGS_TRACE_FLAGS_MASK value
                 * @property {number} SPAN_FLAGS_CONTEXT_HAS_IS_REMOTE_MASK=256 SPAN_FLAGS_CONTEXT_HAS_IS_REMOTE_MASK value
                 * @property {number} SPAN_FLAGS_CONTEXT_IS_REMOTE_MASK=512 SPAN_FLAGS_CONTEXT_IS_REMOTE_MASK value
                 */
                v1.SpanFlags = (function() {
                    const valuesById = {}, values = Object.create(valuesById);
                    values[valuesById[0] = "SPAN_FLAGS_DO_NOT_USE"] = 0;
                    values[valuesById[255] = "SPAN_FLAGS_TRACE_FLAGS_MASK"] = 255;
                    values[valuesById[256] = "SPAN_FLAGS_CONTEXT_HAS_IS_REMOTE_MASK"] = 256;
                    values[valuesById[512] = "SPAN_FLAGS_CONTEXT_IS_REMOTE_MASK"] = 512;
                    return values;
                })();

                return v1;
            })();

            return trace;
        })();

        proto.common = (function() {

            /**
             * Namespace common.
             * @memberof opentelemetry.proto
             * @namespace
             */
            const common = {};

            common.v1 = (function() {

                /**
                 * Namespace v1.
                 * @memberof opentelemetry.proto.common
                 * @namespace
                 */
                const v1 = {};

                v1.AnyValue = (function() {

                    /**
                     * Properties of an AnyValue.
                     * @memberof opentelemetry.proto.common.v1
                     * @interface IAnyValue
                     * @property {string|null} [stringValue] AnyValue stringValue
                     * @property {boolean|null} [boolValue] AnyValue boolValue
                     * @property {number|Long|null} [intValue] AnyValue intValue
                     * @property {number|null} [doubleValue] AnyValue doubleValue
                     * @property {opentelemetry.proto.common.v1.IArrayValue|null} [arrayValue] AnyValue arrayValue
                     * @property {opentelemetry.proto.common.v1.IKeyValueList|null} [kvlistValue] AnyValue kvlistValue
                     * @property {Uint8Array|null} [bytesValue] AnyValue bytesValue
                     */

                    /**
                     * Constructs a new AnyValue.
                     * @memberof opentelemetry.proto.common.v1
                     * @classdesc Represents an AnyValue.
                     * @implements IAnyValue
                     * @constructor
                     * @param {opentelemetry.proto.common.v1.IAnyValue=} [properties] Properties to set
                     */
                    function AnyValue(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * AnyValue stringValue.
                     * @member {string|null|undefined} stringValue
                     * @memberof opentelemetry.proto.common.v1.AnyValue
                     * @instance
                     */
                    AnyValue.prototype.stringValue = null;

                    /**
                     * AnyValue boolValue.
                     * @member {boolean|null|undefined} boolValue
                     * @memberof opentelemetry.proto.common.v1.AnyValue
                     * @instance
                     */
                    AnyValue.prototype.boolValue = null;

                    /**
                     * AnyValue intValue.
                     * @member {number|Long|null|undefined} intValue
                     * @memberof opentelemetry.proto.common.v1.AnyValue
                     * @instance
                     */
                    AnyValue.prototype.intValue = null;

                    /**
                     * AnyValue doubleValue.
                     * @member {number|null|undefined} doubleValue
                     * @memberof opentelemetry.proto.common.v1.AnyValue
                     * @instance
                     */
                    AnyValue.prototype.doubleValue = null;

                    /**
                     * AnyValue arrayValue.
                     * @member {opentelemetry.proto.common.v1.IArrayValue|null|undefined} arrayValue
                     * @memberof opentelemetry.proto.common.v1.AnyValue
                     * @instance
                     */
                    AnyValue.prototype.arrayValue = null;

                    /**
                     * AnyValue kvlistValue.
                     * @member {opentelemetry.proto.common.v1.IKeyValueList|null|undefined} kvlistValue
                     * @memberof opentelemetry.proto.common.v1.AnyValue
                     * @instance
                     */
                    AnyValue.prototype.kvlistValue = null;

                    /**
                     * AnyValue bytesValue.
                     * @member {Uint8Array|null|undefined} bytesValue
                     * @memberof opentelemetry.proto.common.v1.AnyValue
                     * @instance
                     */
                    AnyValue.prototype.bytesValue = null;

                    // OneOf field names bound to virtual getters and setters
                    let $oneOfFields;

                    /**
                     * AnyValue value.
                     * @member {"stringValue"|"boolValue"|"intValue"|"doubleValue"|"arrayValue"|"kvlistValue"|"bytesValue"|undefined} value
                     * @memberof opentelemetry.proto.common.v1.AnyValue
                     * @instance
                     */
                    Object.defineProperty(AnyValue.prototype, "value", {
                        get: $util.oneOfGetter($oneOfFields = ["stringValue", "boolValue", "intValue", "doubleValue", "arrayValue", "kvlistValue", "bytesValue"]),
                        set: $util.oneOfSetter($oneOfFields)
                    });

                    /**
                     * Encodes the specified AnyValue message. Does not implicitly {@link opentelemetry.proto.common.v1.AnyValue.verify|verify} messages.
                     * @function encode
                     * @memberof opentelemetry.proto.common.v1.AnyValue
                     * @static
                     * @param {opentelemetry.proto.common.v1.IAnyValue} message AnyValue message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    AnyValue.encode = function encode(message, writer, q) {
                        if (!writer)
                            writer = $Writer.create();
                        if (q === undefined)
                            q = 0;
                        if (q > $util.recursionLimit)
                            throw Error("max depth exceeded");
                        if (message.stringValue != null && Object.hasOwnProperty.call(message, "stringValue"))
                            writer.uint32(/* id 1, wireType 2 =*/10).string(message.stringValue);
                        if (message.boolValue != null && Object.hasOwnProperty.call(message, "boolValue"))
                            writer.uint32(/* id 2, wireType 0 =*/16).bool(message.boolValue);
                        if (message.intValue != null && Object.hasOwnProperty.call(message, "intValue"))
                            writer.uint32(/* id 3, wireType 0 =*/24).int64(message.intValue);
                        if (message.doubleValue != null && Object.hasOwnProperty.call(message, "doubleValue"))
                            writer.uint32(/* id 4, wireType 1 =*/33).double(message.doubleValue);
                        if (message.arrayValue != null && Object.hasOwnProperty.call(message, "arrayValue"))
                            $root.opentelemetry.proto.common.v1.ArrayValue.encode(message.arrayValue, writer.uint32(/* id 5, wireType 2 =*/42).fork(), q + 1).ldelim();
                        if (message.kvlistValue != null && Object.hasOwnProperty.call(message, "kvlistValue"))
                            $root.opentelemetry.proto.common.v1.KeyValueList.encode(message.kvlistValue, writer.uint32(/* id 6, wireType 2 =*/50).fork(), q + 1).ldelim();
                        if (message.bytesValue != null && Object.hasOwnProperty.call(message, "bytesValue"))
                            writer.uint32(/* id 7, wireType 2 =*/58).bytes(message.bytesValue);
                        return writer;
                    };

                    /**
                     * Decodes an AnyValue message from the specified reader or buffer.
                     * @function decode
                     * @memberof opentelemetry.proto.common.v1.AnyValue
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {opentelemetry.proto.common.v1.AnyValue} AnyValue
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    AnyValue.decode = function decode(reader, length, error, long) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        if (long === undefined)
                            long = 0;
                        if (long > $Reader.recursionLimit)
                            throw Error("maximum nesting depth exceeded");
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.opentelemetry.proto.common.v1.AnyValue();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.stringValue = reader.string();
                                    break;
                                }
                            case 2: {
                                    message.boolValue = reader.bool();
                                    break;
                                }
                            case 3: {
                                    message.intValue = reader.int64();
                                    break;
                                }
                            case 4: {
                                    message.doubleValue = reader.double();
                                    break;
                                }
                            case 5: {
                                    message.arrayValue = $root.opentelemetry.proto.common.v1.ArrayValue.decode(reader, reader.uint32(), undefined, long + 1);
                                    break;
                                }
                            case 6: {
                                    message.kvlistValue = $root.opentelemetry.proto.common.v1.KeyValueList.decode(reader, reader.uint32(), undefined, long + 1);
                                    break;
                                }
                            case 7: {
                                    message.bytesValue = reader.bytes();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7, long);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Gets the default type url for AnyValue
                     * @function getTypeUrl
                     * @memberof opentelemetry.proto.common.v1.AnyValue
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    AnyValue.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/opentelemetry.proto.common.v1.AnyValue";
                    };

                    return AnyValue;
                })();

                v1.ArrayValue = (function() {

                    /**
                     * Properties of an ArrayValue.
                     * @memberof opentelemetry.proto.common.v1
                     * @interface IArrayValue
                     * @property {Array.<opentelemetry.proto.common.v1.IAnyValue>|null} [values] ArrayValue values
                     */

                    /**
                     * Constructs a new ArrayValue.
                     * @memberof opentelemetry.proto.common.v1
                     * @classdesc Represents an ArrayValue.
                     * @implements IArrayValue
                     * @constructor
                     * @param {opentelemetry.proto.common.v1.IArrayValue=} [properties] Properties to set
                     */
                    function ArrayValue(properties) {
                        this.values = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * ArrayValue values.
                     * @member {Array.<opentelemetry.proto.common.v1.IAnyValue>} values
                     * @memberof opentelemetry.proto.common.v1.ArrayValue
                     * @instance
                     */
                    ArrayValue.prototype.values = $util.emptyArray;

                    /**
                     * Encodes the specified ArrayValue message. Does not implicitly {@link opentelemetry.proto.common.v1.ArrayValue.verify|verify} messages.
                     * @function encode
                     * @memberof opentelemetry.proto.common.v1.ArrayValue
                     * @static
                     * @param {opentelemetry.proto.common.v1.IArrayValue} message ArrayValue message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ArrayValue.encode = function encode(message, writer, q) {
                        if (!writer)
                            writer = $Writer.create();
                        if (q === undefined)
                            q = 0;
                        if (q > $util.recursionLimit)
                            throw Error("max depth exceeded");
                        if (message.values != null && message.values.length)
                            for (let i = 0; i < message.values.length; ++i)
                                $root.opentelemetry.proto.common.v1.AnyValue.encode(message.values[i], writer.uint32(/* id 1, wireType 2 =*/10).fork(), q + 1).ldelim();
                        return writer;
                    };

                    /**
                     * Decodes an ArrayValue message from the specified reader or buffer.
                     * @function decode
                     * @memberof opentelemetry.proto.common.v1.ArrayValue
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {opentelemetry.proto.common.v1.ArrayValue} ArrayValue
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ArrayValue.decode = function decode(reader, length, error, long) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        if (long === undefined)
                            long = 0;
                        if (long > $Reader.recursionLimit)
                            throw Error("maximum nesting depth exceeded");
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.opentelemetry.proto.common.v1.ArrayValue();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    if (!(message.values && message.values.length))
                                        message.values = [];
                                    message.values.push($root.opentelemetry.proto.common.v1.AnyValue.decode(reader, reader.uint32(), undefined, long + 1));
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7, long);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Gets the default type url for ArrayValue
                     * @function getTypeUrl
                     * @memberof opentelemetry.proto.common.v1.ArrayValue
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    ArrayValue.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/opentelemetry.proto.common.v1.ArrayValue";
                    };

                    return ArrayValue;
                })();

                v1.KeyValueList = (function() {

                    /**
                     * Properties of a KeyValueList.
                     * @memberof opentelemetry.proto.common.v1
                     * @interface IKeyValueList
                     * @property {Array.<opentelemetry.proto.common.v1.IKeyValue>|null} [values] KeyValueList values
                     */

                    /**
                     * Constructs a new KeyValueList.
                     * @memberof opentelemetry.proto.common.v1
                     * @classdesc Represents a KeyValueList.
                     * @implements IKeyValueList
                     * @constructor
                     * @param {opentelemetry.proto.common.v1.IKeyValueList=} [properties] Properties to set
                     */
                    function KeyValueList(properties) {
                        this.values = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * KeyValueList values.
                     * @member {Array.<opentelemetry.proto.common.v1.IKeyValue>} values
                     * @memberof opentelemetry.proto.common.v1.KeyValueList
                     * @instance
                     */
                    KeyValueList.prototype.values = $util.emptyArray;

                    /**
                     * Encodes the specified KeyValueList message. Does not implicitly {@link opentelemetry.proto.common.v1.KeyValueList.verify|verify} messages.
                     * @function encode
                     * @memberof opentelemetry.proto.common.v1.KeyValueList
                     * @static
                     * @param {opentelemetry.proto.common.v1.IKeyValueList} message KeyValueList message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    KeyValueList.encode = function encode(message, writer, q) {
                        if (!writer)
                            writer = $Writer.create();
                        if (q === undefined)
                            q = 0;
                        if (q > $util.recursionLimit)
                            throw Error("max depth exceeded");
                        if (message.values != null && message.values.length)
                            for (let i = 0; i < message.values.length; ++i)
                                $root.opentelemetry.proto.common.v1.KeyValue.encode(message.values[i], writer.uint32(/* id 1, wireType 2 =*/10).fork(), q + 1).ldelim();
                        return writer;
                    };

                    /**
                     * Decodes a KeyValueList message from the specified reader or buffer.
                     * @function decode
                     * @memberof opentelemetry.proto.common.v1.KeyValueList
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {opentelemetry.proto.common.v1.KeyValueList} KeyValueList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    KeyValueList.decode = function decode(reader, length, error, long) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        if (long === undefined)
                            long = 0;
                        if (long > $Reader.recursionLimit)
                            throw Error("maximum nesting depth exceeded");
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.opentelemetry.proto.common.v1.KeyValueList();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    if (!(message.values && message.values.length))
                                        message.values = [];
                                    message.values.push($root.opentelemetry.proto.common.v1.KeyValue.decode(reader, reader.uint32(), undefined, long + 1));
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7, long);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Gets the default type url for KeyValueList
                     * @function getTypeUrl
                     * @memberof opentelemetry.proto.common.v1.KeyValueList
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    KeyValueList.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/opentelemetry.proto.common.v1.KeyValueList";
                    };

                    return KeyValueList;
                })();

                v1.KeyValue = (function() {

                    /**
                     * Properties of a KeyValue.
                     * @memberof opentelemetry.proto.common.v1
                     * @interface IKeyValue
                     * @property {string|null} [key] KeyValue key
                     * @property {opentelemetry.proto.common.v1.IAnyValue|null} [value] KeyValue value
                     */

                    /**
                     * Constructs a new KeyValue.
                     * @memberof opentelemetry.proto.common.v1
                     * @classdesc Represents a KeyValue.
                     * @implements IKeyValue
                     * @constructor
                     * @param {opentelemetry.proto.common.v1.IKeyValue=} [properties] Properties to set
                     */
                    function KeyValue(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * KeyValue key.
                     * @member {string} key
                     * @memberof opentelemetry.proto.common.v1.KeyValue
                     * @instance
                     */
                    KeyValue.prototype.key = "";

                    /**
                     * KeyValue value.
                     * @member {opentelemetry.proto.common.v1.IAnyValue|null|undefined} value
                     * @memberof opentelemetry.proto.common.v1.KeyValue
                     * @instance
                     */
                    KeyValue.prototype.value = null;

                    /**
                     * Encodes the specified KeyValue message. Does not implicitly {@link opentelemetry.proto.common.v1.KeyValue.verify|verify} messages.
                     * @function encode
                     * @memberof opentelemetry.proto.common.v1.KeyValue
                     * @static
                     * @param {opentelemetry.proto.common.v1.IKeyValue} message KeyValue message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    KeyValue.encode = function encode(message, writer, q) {
                        if (!writer)
                            writer = $Writer.create();
                        if (q === undefined)
                            q = 0;
                        if (q > $util.recursionLimit)
                            throw Error("max depth exceeded");
                        if (message.key != null && Object.hasOwnProperty.call(message, "key"))
                            writer.uint32(/* id 1, wireType 2 =*/10).string(message.key);
                        if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                            $root.opentelemetry.proto.common.v1.AnyValue.encode(message.value, writer.uint32(/* id 2, wireType 2 =*/18).fork(), q + 1).ldelim();
                        return writer;
                    };

                    /**
                     * Decodes a KeyValue message from the specified reader or buffer.
                     * @function decode
                     * @memberof opentelemetry.proto.common.v1.KeyValue
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {opentelemetry.proto.common.v1.KeyValue} KeyValue
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    KeyValue.decode = function decode(reader, length, error, long) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        if (long === undefined)
                            long = 0;
                        if (long > $Reader.recursionLimit)
                            throw Error("maximum nesting depth exceeded");
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.opentelemetry.proto.common.v1.KeyValue();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.key = reader.string();
                                    break;
                                }
                            case 2: {
                                    message.value = $root.opentelemetry.proto.common.v1.AnyValue.decode(reader, reader.uint32(), undefined, long + 1);
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7, long);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Gets the default type url for KeyValue
                     * @function getTypeUrl
                     * @memberof opentelemetry.proto.common.v1.KeyValue
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    KeyValue.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/opentelemetry.proto.common.v1.KeyValue";
                    };

                    return KeyValue;
                })();

                v1.InstrumentationScope = (function() {

                    /**
                     * Properties of an InstrumentationScope.
                     * @memberof opentelemetry.proto.common.v1
                     * @interface IInstrumentationScope
                     * @property {string|null} [name] InstrumentationScope name
                     * @property {string|null} [version] InstrumentationScope version
                     * @property {Array.<opentelemetry.proto.common.v1.IKeyValue>|null} [attributes] InstrumentationScope attributes
                     * @property {number|null} [droppedAttributesCount] InstrumentationScope droppedAttributesCount
                     */

                    /**
                     * Constructs a new InstrumentationScope.
                     * @memberof opentelemetry.proto.common.v1
                     * @classdesc Represents an InstrumentationScope.
                     * @implements IInstrumentationScope
                     * @constructor
                     * @param {opentelemetry.proto.common.v1.IInstrumentationScope=} [properties] Properties to set
                     */
                    function InstrumentationScope(properties) {
                        this.attributes = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * InstrumentationScope name.
                     * @member {string} name
                     * @memberof opentelemetry.proto.common.v1.InstrumentationScope
                     * @instance
                     */
                    InstrumentationScope.prototype.name = "";

                    /**
                     * InstrumentationScope version.
                     * @member {string} version
                     * @memberof opentelemetry.proto.common.v1.InstrumentationScope
                     * @instance
                     */
                    InstrumentationScope.prototype.version = "";

                    /**
                     * InstrumentationScope attributes.
                     * @member {Array.<opentelemetry.proto.common.v1.IKeyValue>} attributes
                     * @memberof opentelemetry.proto.common.v1.InstrumentationScope
                     * @instance
                     */
                    InstrumentationScope.prototype.attributes = $util.emptyArray;

                    /**
                     * InstrumentationScope droppedAttributesCount.
                     * @member {number} droppedAttributesCount
                     * @memberof opentelemetry.proto.common.v1.InstrumentationScope
                     * @instance
                     */
                    InstrumentationScope.prototype.droppedAttributesCount = 0;

                    /**
                     * Encodes the specified InstrumentationScope message. Does not implicitly {@link opentelemetry.proto.common.v1.InstrumentationScope.verify|verify} messages.
                     * @function encode
                     * @memberof opentelemetry.proto.common.v1.InstrumentationScope
                     * @static
                     * @param {opentelemetry.proto.common.v1.IInstrumentationScope} message InstrumentationScope message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    InstrumentationScope.encode = function encode(message, writer, q) {
                        if (!writer)
                            writer = $Writer.create();
                        if (q === undefined)
                            q = 0;
                        if (q > $util.recursionLimit)
                            throw Error("max depth exceeded");
                        if (message.name != null && Object.hasOwnProperty.call(message, "name"))
                            writer.uint32(/* id 1, wireType 2 =*/10).string(message.name);
                        if (message.version != null && Object.hasOwnProperty.call(message, "version"))
                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.version);
                        if (message.attributes != null && message.attributes.length)
                            for (let i = 0; i < message.attributes.length; ++i)
                                $root.opentelemetry.proto.common.v1.KeyValue.encode(message.attributes[i], writer.uint32(/* id 3, wireType 2 =*/26).fork(), q + 1).ldelim();
                        if (message.droppedAttributesCount != null && Object.hasOwnProperty.call(message, "droppedAttributesCount"))
                            writer.uint32(/* id 4, wireType 0 =*/32).uint32(message.droppedAttributesCount);
                        return writer;
                    };

                    /**
                     * Decodes an InstrumentationScope message from the specified reader or buffer.
                     * @function decode
                     * @memberof opentelemetry.proto.common.v1.InstrumentationScope
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {opentelemetry.proto.common.v1.InstrumentationScope} InstrumentationScope
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    InstrumentationScope.decode = function decode(reader, length, error, long) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        if (long === undefined)
                            long = 0;
                        if (long > $Reader.recursionLimit)
                            throw Error("maximum nesting depth exceeded");
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.opentelemetry.proto.common.v1.InstrumentationScope();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.name = reader.string();
                                    break;
                                }
                            case 2: {
                                    message.version = reader.string();
                                    break;
                                }
                            case 3: {
                                    if (!(message.attributes && message.attributes.length))
                                        message.attributes = [];
                                    message.attributes.push($root.opentelemetry.proto.common.v1.KeyValue.decode(reader, reader.uint32(), undefined, long + 1));
                                    break;
                                }
                            case 4: {
                                    message.droppedAttributesCount = reader.uint32();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7, long);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Gets the default type url for InstrumentationScope
                     * @function getTypeUrl
                     * @memberof opentelemetry.proto.common.v1.InstrumentationScope
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    InstrumentationScope.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/opentelemetry.proto.common.v1.InstrumentationScope";
                    };

                    return InstrumentationScope;
                })();

                return v1;
            })();

            return common;
        })();

        proto.resource = (function() {

            /**
             * Namespace resource.
             * @memberof opentelemetry.proto
             * @namespace
             */
            const resource = {};

            resource.v1 = (function() {

                /**
                 * Namespace v1.
                 * @memberof opentelemetry.proto.resource
                 * @namespace
                 */
                const v1 = {};

                v1.Resource = (function() {

                    /**
                     * Properties of a Resource.
                     * @memberof opentelemetry.proto.resource.v1
                     * @interface IResource
                     * @property {Array.<opentelemetry.proto.common.v1.IKeyValue>|null} [attributes] Resource attributes
                     * @property {number|null} [droppedAttributesCount] Resource droppedAttributesCount
                     */

                    /**
                     * Constructs a new Resource.
                     * @memberof opentelemetry.proto.resource.v1
                     * @classdesc Represents a Resource.
                     * @implements IResource
                     * @constructor
                     * @param {opentelemetry.proto.resource.v1.IResource=} [properties] Properties to set
                     */
                    function Resource(properties) {
                        this.attributes = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * Resource attributes.
                     * @member {Array.<opentelemetry.proto.common.v1.IKeyValue>} attributes
                     * @memberof opentelemetry.proto.resource.v1.Resource
                     * @instance
                     */
                    Resource.prototype.attributes = $util.emptyArray;

                    /**
                     * Resource droppedAttributesCount.
                     * @member {number} droppedAttributesCount
                     * @memberof opentelemetry.proto.resource.v1.Resource
                     * @instance
                     */
                    Resource.prototype.droppedAttributesCount = 0;

                    /**
                     * Encodes the specified Resource message. Does not implicitly {@link opentelemetry.proto.resource.v1.Resource.verify|verify} messages.
                     * @function encode
                     * @memberof opentelemetry.proto.resource.v1.Resource
                     * @static
                     * @param {opentelemetry.proto.resource.v1.IResource} message Resource message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Resource.encode = function encode(message, writer, q) {
                        if (!writer)
                            writer = $Writer.create();
                        if (q === undefined)
                            q = 0;
                        if (q > $util.recursionLimit)
                            throw Error("max depth exceeded");
                        if (message.attributes != null && message.attributes.length)
                            for (let i = 0; i < message.attributes.length; ++i)
                                $root.opentelemetry.proto.common.v1.KeyValue.encode(message.attributes[i], writer.uint32(/* id 1, wireType 2 =*/10).fork(), q + 1).ldelim();
                        if (message.droppedAttributesCount != null && Object.hasOwnProperty.call(message, "droppedAttributesCount"))
                            writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.droppedAttributesCount);
                        return writer;
                    };

                    /**
                     * Decodes a Resource message from the specified reader or buffer.
                     * @function decode
                     * @memberof opentelemetry.proto.resource.v1.Resource
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {opentelemetry.proto.resource.v1.Resource} Resource
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Resource.decode = function decode(reader, length, error, long) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        if (long === undefined)
                            long = 0;
                        if (long > $Reader.recursionLimit)
                            throw Error("maximum nesting depth exceeded");
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.opentelemetry.proto.resource.v1.Resource();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    if (!(message.attributes && message.attributes.length))
                                        message.attributes = [];
                                    message.attributes.push($root.opentelemetry.proto.common.v1.KeyValue.decode(reader, reader.uint32(), undefined, long + 1));
                                    break;
                                }
                            case 2: {
                                    message.droppedAttributesCount = reader.uint32();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7, long);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Gets the default type url for Resource
                     * @function getTypeUrl
                     * @memberof opentelemetry.proto.resource.v1.Resource
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    Resource.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/opentelemetry.proto.resource.v1.Resource";
                    };

                    return Resource;
                })();

                return v1;
            })();

            return resource;
        })();

        proto.logs = (function() {

            /**
             * Namespace logs.
             * @memberof opentelemetry.proto
             * @namespace
             */
            const logs = {};

            logs.v1 = (function() {

                /**
                 * Namespace v1.
                 * @memberof opentelemetry.proto.logs
                 * @namespace
                 */
                const v1 = {};

                v1.LogsData = (function() {

                    /**
                     * Properties of a LogsData.
                     * @memberof opentelemetry.proto.logs.v1
                     * @interface ILogsData
                     * @property {Array.<opentelemetry.proto.logs.v1.IResourceLogs>|null} [resourceLogs] LogsData resourceLogs
                     */

                    /**
                     * Constructs a new LogsData.
                     * @memberof opentelemetry.proto.logs.v1
                     * @classdesc Represents a LogsData.
                     * @implements ILogsData
                     * @constructor
                     * @param {opentelemetry.proto.logs.v1.ILogsData=} [properties] Properties to set
                     */
                    function LogsData(properties) {
                        this.resourceLogs = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * LogsData resourceLogs.
                     * @member {Array.<opentelemetry.proto.logs.v1.IResourceLogs>} resourceLogs
                     * @memberof opentelemetry.proto.logs.v1.LogsData
                     * @instance
                     */
                    LogsData.prototype.resourceLogs = $util.emptyArray;

                    /**
                     * Encodes the specified LogsData message. Does not implicitly {@link opentelemetry.proto.logs.v1.LogsData.verify|verify} messages.
                     * @function encode
                     * @memberof opentelemetry.proto.logs.v1.LogsData
                     * @static
                     * @param {opentelemetry.proto.logs.v1.ILogsData} message LogsData message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    LogsData.encode = function encode(message, writer, q) {
                        if (!writer)
                            writer = $Writer.create();
                        if (q === undefined)
                            q = 0;
                        if (q > $util.recursionLimit)
                            throw Error("max depth exceeded");
                        if (message.resourceLogs != null && message.resourceLogs.length)
                            for (let i = 0; i < message.resourceLogs.length; ++i)
                                $root.opentelemetry.proto.logs.v1.ResourceLogs.encode(message.resourceLogs[i], writer.uint32(/* id 1, wireType 2 =*/10).fork(), q + 1).ldelim();
                        return writer;
                    };

                    /**
                     * Decodes a LogsData message from the specified reader or buffer.
                     * @function decode
                     * @memberof opentelemetry.proto.logs.v1.LogsData
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {opentelemetry.proto.logs.v1.LogsData} LogsData
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    LogsData.decode = function decode(reader, length, error, long) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        if (long === undefined)
                            long = 0;
                        if (long > $Reader.recursionLimit)
                            throw Error("maximum nesting depth exceeded");
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.opentelemetry.proto.logs.v1.LogsData();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    if (!(message.resourceLogs && message.resourceLogs.length))
                                        message.resourceLogs = [];
                                    message.resourceLogs.push($root.opentelemetry.proto.logs.v1.ResourceLogs.decode(reader, reader.uint32(), undefined, long + 1));
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7, long);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Gets the default type url for LogsData
                     * @function getTypeUrl
                     * @memberof opentelemetry.proto.logs.v1.LogsData
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    LogsData.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/opentelemetry.proto.logs.v1.LogsData";
                    };

                    return LogsData;
                })();

                v1.ResourceLogs = (function() {

                    /**
                     * Properties of a ResourceLogs.
                     * @memberof opentelemetry.proto.logs.v1
                     * @interface IResourceLogs
                     * @property {opentelemetry.proto.resource.v1.IResource|null} [resource] ResourceLogs resource
                     * @property {Array.<opentelemetry.proto.logs.v1.IScopeLogs>|null} [scopeLogs] ResourceLogs scopeLogs
                     * @property {string|null} [schemaUrl] ResourceLogs schemaUrl
                     */

                    /**
                     * Constructs a new ResourceLogs.
                     * @memberof opentelemetry.proto.logs.v1
                     * @classdesc Represents a ResourceLogs.
                     * @implements IResourceLogs
                     * @constructor
                     * @param {opentelemetry.proto.logs.v1.IResourceLogs=} [properties] Properties to set
                     */
                    function ResourceLogs(properties) {
                        this.scopeLogs = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * ResourceLogs resource.
                     * @member {opentelemetry.proto.resource.v1.IResource|null|undefined} resource
                     * @memberof opentelemetry.proto.logs.v1.ResourceLogs
                     * @instance
                     */
                    ResourceLogs.prototype.resource = null;

                    /**
                     * ResourceLogs scopeLogs.
                     * @member {Array.<opentelemetry.proto.logs.v1.IScopeLogs>} scopeLogs
                     * @memberof opentelemetry.proto.logs.v1.ResourceLogs
                     * @instance
                     */
                    ResourceLogs.prototype.scopeLogs = $util.emptyArray;

                    /**
                     * ResourceLogs schemaUrl.
                     * @member {string} schemaUrl
                     * @memberof opentelemetry.proto.logs.v1.ResourceLogs
                     * @instance
                     */
                    ResourceLogs.prototype.schemaUrl = "";

                    /**
                     * Encodes the specified ResourceLogs message. Does not implicitly {@link opentelemetry.proto.logs.v1.ResourceLogs.verify|verify} messages.
                     * @function encode
                     * @memberof opentelemetry.proto.logs.v1.ResourceLogs
                     * @static
                     * @param {opentelemetry.proto.logs.v1.IResourceLogs} message ResourceLogs message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ResourceLogs.encode = function encode(message, writer, q) {
                        if (!writer)
                            writer = $Writer.create();
                        if (q === undefined)
                            q = 0;
                        if (q > $util.recursionLimit)
                            throw Error("max depth exceeded");
                        if (message.resource != null && Object.hasOwnProperty.call(message, "resource"))
                            $root.opentelemetry.proto.resource.v1.Resource.encode(message.resource, writer.uint32(/* id 1, wireType 2 =*/10).fork(), q + 1).ldelim();
                        if (message.scopeLogs != null && message.scopeLogs.length)
                            for (let i = 0; i < message.scopeLogs.length; ++i)
                                $root.opentelemetry.proto.logs.v1.ScopeLogs.encode(message.scopeLogs[i], writer.uint32(/* id 2, wireType 2 =*/18).fork(), q + 1).ldelim();
                        if (message.schemaUrl != null && Object.hasOwnProperty.call(message, "schemaUrl"))
                            writer.uint32(/* id 3, wireType 2 =*/26).string(message.schemaUrl);
                        return writer;
                    };

                    /**
                     * Decodes a ResourceLogs message from the specified reader or buffer.
                     * @function decode
                     * @memberof opentelemetry.proto.logs.v1.ResourceLogs
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {opentelemetry.proto.logs.v1.ResourceLogs} ResourceLogs
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ResourceLogs.decode = function decode(reader, length, error, long) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        if (long === undefined)
                            long = 0;
                        if (long > $Reader.recursionLimit)
                            throw Error("maximum nesting depth exceeded");
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.opentelemetry.proto.logs.v1.ResourceLogs();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.resource = $root.opentelemetry.proto.resource.v1.Resource.decode(reader, reader.uint32(), undefined, long + 1);
                                    break;
                                }
                            case 2: {
                                    if (!(message.scopeLogs && message.scopeLogs.length))
                                        message.scopeLogs = [];
                                    message.scopeLogs.push($root.opentelemetry.proto.logs.v1.ScopeLogs.decode(reader, reader.uint32(), undefined, long + 1));
                                    break;
                                }
                            case 3: {
                                    message.schemaUrl = reader.string();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7, long);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Gets the default type url for ResourceLogs
                     * @function getTypeUrl
                     * @memberof opentelemetry.proto.logs.v1.ResourceLogs
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    ResourceLogs.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/opentelemetry.proto.logs.v1.ResourceLogs";
                    };

                    return ResourceLogs;
                })();

                v1.ScopeLogs = (function() {

                    /**
                     * Properties of a ScopeLogs.
                     * @memberof opentelemetry.proto.logs.v1
                     * @interface IScopeLogs
                     * @property {opentelemetry.proto.common.v1.IInstrumentationScope|null} [scope] ScopeLogs scope
                     * @property {Array.<opentelemetry.proto.logs.v1.ILogRecord>|null} [logRecords] ScopeLogs logRecords
                     * @property {string|null} [schemaUrl] ScopeLogs schemaUrl
                     */

                    /**
                     * Constructs a new ScopeLogs.
                     * @memberof opentelemetry.proto.logs.v1
                     * @classdesc Represents a ScopeLogs.
                     * @implements IScopeLogs
                     * @constructor
                     * @param {opentelemetry.proto.logs.v1.IScopeLogs=} [properties] Properties to set
                     */
                    function ScopeLogs(properties) {
                        this.logRecords = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * ScopeLogs scope.
                     * @member {opentelemetry.proto.common.v1.IInstrumentationScope|null|undefined} scope
                     * @memberof opentelemetry.proto.logs.v1.ScopeLogs
                     * @instance
                     */
                    ScopeLogs.prototype.scope = null;

                    /**
                     * ScopeLogs logRecords.
                     * @member {Array.<opentelemetry.proto.logs.v1.ILogRecord>} logRecords
                     * @memberof opentelemetry.proto.logs.v1.ScopeLogs
                     * @instance
                     */
                    ScopeLogs.prototype.logRecords = $util.emptyArray;

                    /**
                     * ScopeLogs schemaUrl.
                     * @member {string} schemaUrl
                     * @memberof opentelemetry.proto.logs.v1.ScopeLogs
                     * @instance
                     */
                    ScopeLogs.prototype.schemaUrl = "";

                    /**
                     * Encodes the specified ScopeLogs message. Does not implicitly {@link opentelemetry.proto.logs.v1.ScopeLogs.verify|verify} messages.
                     * @function encode
                     * @memberof opentelemetry.proto.logs.v1.ScopeLogs
                     * @static
                     * @param {opentelemetry.proto.logs.v1.IScopeLogs} message ScopeLogs message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ScopeLogs.encode = function encode(message, writer, q) {
                        if (!writer)
                            writer = $Writer.create();
                        if (q === undefined)
                            q = 0;
                        if (q > $util.recursionLimit)
                            throw Error("max depth exceeded");
                        if (message.scope != null && Object.hasOwnProperty.call(message, "scope"))
                            $root.opentelemetry.proto.common.v1.InstrumentationScope.encode(message.scope, writer.uint32(/* id 1, wireType 2 =*/10).fork(), q + 1).ldelim();
                        if (message.logRecords != null && message.logRecords.length)
                            for (let i = 0; i < message.logRecords.length; ++i)
                                $root.opentelemetry.proto.logs.v1.LogRecord.encode(message.logRecords[i], writer.uint32(/* id 2, wireType 2 =*/18).fork(), q + 1).ldelim();
                        if (message.schemaUrl != null && Object.hasOwnProperty.call(message, "schemaUrl"))
                            writer.uint32(/* id 3, wireType 2 =*/26).string(message.schemaUrl);
                        return writer;
                    };

                    /**
                     * Decodes a ScopeLogs message from the specified reader or buffer.
                     * @function decode
                     * @memberof opentelemetry.proto.logs.v1.ScopeLogs
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {opentelemetry.proto.logs.v1.ScopeLogs} ScopeLogs
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ScopeLogs.decode = function decode(reader, length, error, long) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        if (long === undefined)
                            long = 0;
                        if (long > $Reader.recursionLimit)
                            throw Error("maximum nesting depth exceeded");
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.opentelemetry.proto.logs.v1.ScopeLogs();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.scope = $root.opentelemetry.proto.common.v1.InstrumentationScope.decode(reader, reader.uint32(), undefined, long + 1);
                                    break;
                                }
                            case 2: {
                                    if (!(message.logRecords && message.logRecords.length))
                                        message.logRecords = [];
                                    message.logRecords.push($root.opentelemetry.proto.logs.v1.LogRecord.decode(reader, reader.uint32(), undefined, long + 1));
                                    break;
                                }
                            case 3: {
                                    message.schemaUrl = reader.string();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7, long);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Gets the default type url for ScopeLogs
                     * @function getTypeUrl
                     * @memberof opentelemetry.proto.logs.v1.ScopeLogs
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    ScopeLogs.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/opentelemetry.proto.logs.v1.ScopeLogs";
                    };

                    return ScopeLogs;
                })();

                /**
                 * SeverityNumber enum.
                 * @name opentelemetry.proto.logs.v1.SeverityNumber
                 * @enum {number}
                 * @property {number} SEVERITY_NUMBER_UNSPECIFIED=0 SEVERITY_NUMBER_UNSPECIFIED value
                 * @property {number} SEVERITY_NUMBER_TRACE=1 SEVERITY_NUMBER_TRACE value
                 * @property {number} SEVERITY_NUMBER_TRACE2=2 SEVERITY_NUMBER_TRACE2 value
                 * @property {number} SEVERITY_NUMBER_TRACE3=3 SEVERITY_NUMBER_TRACE3 value
                 * @property {number} SEVERITY_NUMBER_TRACE4=4 SEVERITY_NUMBER_TRACE4 value
                 * @property {number} SEVERITY_NUMBER_DEBUG=5 SEVERITY_NUMBER_DEBUG value
                 * @property {number} SEVERITY_NUMBER_DEBUG2=6 SEVERITY_NUMBER_DEBUG2 value
                 * @property {number} SEVERITY_NUMBER_DEBUG3=7 SEVERITY_NUMBER_DEBUG3 value
                 * @property {number} SEVERITY_NUMBER_DEBUG4=8 SEVERITY_NUMBER_DEBUG4 value
                 * @property {number} SEVERITY_NUMBER_INFO=9 SEVERITY_NUMBER_INFO value
                 * @property {number} SEVERITY_NUMBER_INFO2=10 SEVERITY_NUMBER_INFO2 value
                 * @property {number} SEVERITY_NUMBER_INFO3=11 SEVERITY_NUMBER_INFO3 value
                 * @property {number} SEVERITY_NUMBER_INFO4=12 SEVERITY_NUMBER_INFO4 value
                 * @property {number} SEVERITY_NUMBER_WARN=13 SEVERITY_NUMBER_WARN value
                 * @property {number} SEVERITY_NUMBER_WARN2=14 SEVERITY_NUMBER_WARN2 value
                 * @property {number} SEVERITY_NUMBER_WARN3=15 SEVERITY_NUMBER_WARN3 value
                 * @property {number} SEVERITY_NUMBER_WARN4=16 SEVERITY_NUMBER_WARN4 value
                 * @property {number} SEVERITY_NUMBER_ERROR=17 SEVERITY_NUMBER_ERROR value
                 * @property {number} SEVERITY_NUMBER_ERROR2=18 SEVERITY_NUMBER_ERROR2 value
                 * @property {number} SEVERITY_NUMBER_ERROR3=19 SEVERITY_NUMBER_ERROR3 value
                 * @property {number} SEVERITY_NUMBER_ERROR4=20 SEVERITY_NUMBER_ERROR4 value
                 * @property {number} SEVERITY_NUMBER_FATAL=21 SEVERITY_NUMBER_FATAL value
                 * @property {number} SEVERITY_NUMBER_FATAL2=22 SEVERITY_NUMBER_FATAL2 value
                 * @property {number} SEVERITY_NUMBER_FATAL3=23 SEVERITY_NUMBER_FATAL3 value
                 * @property {number} SEVERITY_NUMBER_FATAL4=24 SEVERITY_NUMBER_FATAL4 value
                 */
                v1.SeverityNumber = (function() {
                    const valuesById = {}, values = Object.create(valuesById);
                    values[valuesById[0] = "SEVERITY_NUMBER_UNSPECIFIED"] = 0;
                    values[valuesById[1] = "SEVERITY_NUMBER_TRACE"] = 1;
                    values[valuesById[2] = "SEVERITY_NUMBER_TRACE2"] = 2;
                    values[valuesById[3] = "SEVERITY_NUMBER_TRACE3"] = 3;
                    values[valuesById[4] = "SEVERITY_NUMBER_TRACE4"] = 4;
                    values[valuesById[5] = "SEVERITY_NUMBER_DEBUG"] = 5;
                    values[valuesById[6] = "SEVERITY_NUMBER_DEBUG2"] = 6;
                    values[valuesById[7] = "SEVERITY_NUMBER_DEBUG3"] = 7;
                    values[valuesById[8] = "SEVERITY_NUMBER_DEBUG4"] = 8;
                    values[valuesById[9] = "SEVERITY_NUMBER_INFO"] = 9;
                    values[valuesById[10] = "SEVERITY_NUMBER_INFO2"] = 10;
                    values[valuesById[11] = "SEVERITY_NUMBER_INFO3"] = 11;
                    values[valuesById[12] = "SEVERITY_NUMBER_INFO4"] = 12;
                    values[valuesById[13] = "SEVERITY_NUMBER_WARN"] = 13;
                    values[valuesById[14] = "SEVERITY_NUMBER_WARN2"] = 14;
                    values[valuesById[15] = "SEVERITY_NUMBER_WARN3"] = 15;
                    values[valuesById[16] = "SEVERITY_NUMBER_WARN4"] = 16;
                    values[valuesById[17] = "SEVERITY_NUMBER_ERROR"] = 17;
                    values[valuesById[18] = "SEVERITY_NUMBER_ERROR2"] = 18;
                    values[valuesById[19] = "SEVERITY_NUMBER_ERROR3"] = 19;
                    values[valuesById[20] = "SEVERITY_NUMBER_ERROR4"] = 20;
                    values[valuesById[21] = "SEVERITY_NUMBER_FATAL"] = 21;
                    values[valuesById[22] = "SEVERITY_NUMBER_FATAL2"] = 22;
                    values[valuesById[23] = "SEVERITY_NUMBER_FATAL3"] = 23;
                    values[valuesById[24] = "SEVERITY_NUMBER_FATAL4"] = 24;
                    return values;
                })();

                /**
                 * LogRecordFlags enum.
                 * @name opentelemetry.proto.logs.v1.LogRecordFlags
                 * @enum {number}
                 * @property {number} LOG_RECORD_FLAGS_DO_NOT_USE=0 LOG_RECORD_FLAGS_DO_NOT_USE value
                 * @property {number} LOG_RECORD_FLAGS_TRACE_FLAGS_MASK=255 LOG_RECORD_FLAGS_TRACE_FLAGS_MASK value
                 */
                v1.LogRecordFlags = (function() {
                    const valuesById = {}, values = Object.create(valuesById);
                    values[valuesById[0] = "LOG_RECORD_FLAGS_DO_NOT_USE"] = 0;
                    values[valuesById[255] = "LOG_RECORD_FLAGS_TRACE_FLAGS_MASK"] = 255;
                    return values;
                })();

                v1.LogRecord = (function() {

                    /**
                     * Properties of a LogRecord.
                     * @memberof opentelemetry.proto.logs.v1
                     * @interface ILogRecord
                     * @property {number|Long|null} [timeUnixNano] LogRecord timeUnixNano
                     * @property {number|Long|null} [observedTimeUnixNano] LogRecord observedTimeUnixNano
                     * @property {opentelemetry.proto.logs.v1.SeverityNumber|null} [severityNumber] LogRecord severityNumber
                     * @property {string|null} [severityText] LogRecord severityText
                     * @property {opentelemetry.proto.common.v1.IAnyValue|null} [body] LogRecord body
                     * @property {Array.<opentelemetry.proto.common.v1.IKeyValue>|null} [attributes] LogRecord attributes
                     * @property {number|null} [droppedAttributesCount] LogRecord droppedAttributesCount
                     * @property {number|null} [flags] LogRecord flags
                     * @property {Uint8Array|null} [traceId] LogRecord traceId
                     * @property {Uint8Array|null} [spanId] LogRecord spanId
                     * @property {string|null} [eventName] LogRecord eventName
                     */

                    /**
                     * Constructs a new LogRecord.
                     * @memberof opentelemetry.proto.logs.v1
                     * @classdesc Represents a LogRecord.
                     * @implements ILogRecord
                     * @constructor
                     * @param {opentelemetry.proto.logs.v1.ILogRecord=} [properties] Properties to set
                     */
                    function LogRecord(properties) {
                        this.attributes = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * LogRecord timeUnixNano.
                     * @member {number|Long} timeUnixNano
                     * @memberof opentelemetry.proto.logs.v1.LogRecord
                     * @instance
                     */
                    LogRecord.prototype.timeUnixNano = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

                    /**
                     * LogRecord observedTimeUnixNano.
                     * @member {number|Long} observedTimeUnixNano
                     * @memberof opentelemetry.proto.logs.v1.LogRecord
                     * @instance
                     */
                    LogRecord.prototype.observedTimeUnixNano = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

                    /**
                     * LogRecord severityNumber.
                     * @member {opentelemetry.proto.logs.v1.SeverityNumber} severityNumber
                     * @memberof opentelemetry.proto.logs.v1.LogRecord
                     * @instance
                     */
                    LogRecord.prototype.severityNumber = 0;

                    /**
                     * LogRecord severityText.
                     * @member {string} severityText
                     * @memberof opentelemetry.proto.logs.v1.LogRecord
                     * @instance
                     */
                    LogRecord.prototype.severityText = "";

                    /**
                     * LogRecord body.
                     * @member {opentelemetry.proto.common.v1.IAnyValue|null|undefined} body
                     * @memberof opentelemetry.proto.logs.v1.LogRecord
                     * @instance
                     */
                    LogRecord.prototype.body = null;

                    /**
                     * LogRecord attributes.
                     * @member {Array.<opentelemetry.proto.common.v1.IKeyValue>} attributes
                     * @memberof opentelemetry.proto.logs.v1.LogRecord
                     * @instance
                     */
                    LogRecord.prototype.attributes = $util.emptyArray;

                    /**
                     * LogRecord droppedAttributesCount.
                     * @member {number} droppedAttributesCount
                     * @memberof opentelemetry.proto.logs.v1.LogRecord
                     * @instance
                     */
                    LogRecord.prototype.droppedAttributesCount = 0;

                    /**
                     * LogRecord flags.
                     * @member {number} flags
                     * @memberof opentelemetry.proto.logs.v1.LogRecord
                     * @instance
                     */
                    LogRecord.prototype.flags = 0;

                    /**
                     * LogRecord traceId.
                     * @member {Uint8Array} traceId
                     * @memberof opentelemetry.proto.logs.v1.LogRecord
                     * @instance
                     */
                    LogRecord.prototype.traceId = $util.newBuffer([]);

                    /**
                     * LogRecord spanId.
                     * @member {Uint8Array} spanId
                     * @memberof opentelemetry.proto.logs.v1.LogRecord
                     * @instance
                     */
                    LogRecord.prototype.spanId = $util.newBuffer([]);

                    /**
                     * LogRecord eventName.
                     * @member {string} eventName
                     * @memberof opentelemetry.proto.logs.v1.LogRecord
                     * @instance
                     */
                    LogRecord.prototype.eventName = "";

                    /**
                     * Encodes the specified LogRecord message. Does not implicitly {@link opentelemetry.proto.logs.v1.LogRecord.verify|verify} messages.
                     * @function encode
                     * @memberof opentelemetry.proto.logs.v1.LogRecord
                     * @static
                     * @param {opentelemetry.proto.logs.v1.ILogRecord} message LogRecord message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    LogRecord.encode = function encode(message, writer, q) {
                        if (!writer)
                            writer = $Writer.create();
                        if (q === undefined)
                            q = 0;
                        if (q > $util.recursionLimit)
                            throw Error("max depth exceeded");
                        if (message.timeUnixNano != null && Object.hasOwnProperty.call(message, "timeUnixNano"))
                            writer.uint32(/* id 1, wireType 1 =*/9).fixed64(message.timeUnixNano);
                        if (message.severityNumber != null && Object.hasOwnProperty.call(message, "severityNumber"))
                            writer.uint32(/* id 2, wireType 0 =*/16).int32(message.severityNumber);
                        if (message.severityText != null && Object.hasOwnProperty.call(message, "severityText"))
                            writer.uint32(/* id 3, wireType 2 =*/26).string(message.severityText);
                        if (message.body != null && Object.hasOwnProperty.call(message, "body"))
                            $root.opentelemetry.proto.common.v1.AnyValue.encode(message.body, writer.uint32(/* id 5, wireType 2 =*/42).fork(), q + 1).ldelim();
                        if (message.attributes != null && message.attributes.length)
                            for (let i = 0; i < message.attributes.length; ++i)
                                $root.opentelemetry.proto.common.v1.KeyValue.encode(message.attributes[i], writer.uint32(/* id 6, wireType 2 =*/50).fork(), q + 1).ldelim();
                        if (message.droppedAttributesCount != null && Object.hasOwnProperty.call(message, "droppedAttributesCount"))
                            writer.uint32(/* id 7, wireType 0 =*/56).uint32(message.droppedAttributesCount);
                        if (message.flags != null && Object.hasOwnProperty.call(message, "flags"))
                            writer.uint32(/* id 8, wireType 5 =*/69).fixed32(message.flags);
                        if (message.traceId != null && Object.hasOwnProperty.call(message, "traceId"))
                            writer.uint32(/* id 9, wireType 2 =*/74).bytes(message.traceId);
                        if (message.spanId != null && Object.hasOwnProperty.call(message, "spanId"))
                            writer.uint32(/* id 10, wireType 2 =*/82).bytes(message.spanId);
                        if (message.observedTimeUnixNano != null && Object.hasOwnProperty.call(message, "observedTimeUnixNano"))
                            writer.uint32(/* id 11, wireType 1 =*/89).fixed64(message.observedTimeUnixNano);
                        if (message.eventName != null && Object.hasOwnProperty.call(message, "eventName"))
                            writer.uint32(/* id 12, wireType 2 =*/98).string(message.eventName);
                        return writer;
                    };

                    /**
                     * Decodes a LogRecord message from the specified reader or buffer.
                     * @function decode
                     * @memberof opentelemetry.proto.logs.v1.LogRecord
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {opentelemetry.proto.logs.v1.LogRecord} LogRecord
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    LogRecord.decode = function decode(reader, length, error, long) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        if (long === undefined)
                            long = 0;
                        if (long > $Reader.recursionLimit)
                            throw Error("maximum nesting depth exceeded");
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.opentelemetry.proto.logs.v1.LogRecord();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.timeUnixNano = reader.fixed64();
                                    break;
                                }
                            case 11: {
                                    message.observedTimeUnixNano = reader.fixed64();
                                    break;
                                }
                            case 2: {
                                    message.severityNumber = reader.int32();
                                    break;
                                }
                            case 3: {
                                    message.severityText = reader.string();
                                    break;
                                }
                            case 5: {
                                    message.body = $root.opentelemetry.proto.common.v1.AnyValue.decode(reader, reader.uint32(), undefined, long + 1);
                                    break;
                                }
                            case 6: {
                                    if (!(message.attributes && message.attributes.length))
                                        message.attributes = [];
                                    message.attributes.push($root.opentelemetry.proto.common.v1.KeyValue.decode(reader, reader.uint32(), undefined, long + 1));
                                    break;
                                }
                            case 7: {
                                    message.droppedAttributesCount = reader.uint32();
                                    break;
                                }
                            case 8: {
                                    message.flags = reader.fixed32();
                                    break;
                                }
                            case 9: {
                                    message.traceId = reader.bytes();
                                    break;
                                }
                            case 10: {
                                    message.spanId = reader.bytes();
                                    break;
                                }
                            case 12: {
                                    message.eventName = reader.string();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7, long);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Gets the default type url for LogRecord
                     * @function getTypeUrl
                     * @memberof opentelemetry.proto.logs.v1.LogRecord
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    LogRecord.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/opentelemetry.proto.logs.v1.LogRecord";
                    };

                    return LogRecord;
                })();

                return v1;
            })();

            return logs;
        })();

        return proto;
    })();

    return opentelemetry;
})();

export { $root as default };
