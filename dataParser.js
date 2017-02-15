var Int64BE = require("int64-buffer").Int64BE;

// string to byte array - http://stackoverflow.com/questions/6226189/how-to-convert-a-string-to-bytearray
/*
 var str = "Hello?";
 var bytesv2 = []; // char codes

 for (var i = 0; i < str.length; ++i) {
 var code = str.charCodeAt(i);
 bytesv2 = bytesv2.concat([code & 0xff, code / 256 >>> 0]);
 }
 */

function PhasorPointBinaryDataParser() {
    var _offset = 0;
    var _dataBytes = [];
    var _data;

    function Parse(dataBytes) {
        if (dataBytes == null) {
            return null;
        }

        try {
            _offset = 0;
            _dataBytes = dataBytes;
            var buffSize = _dataBytes.length;

            var version = GetVersion();
            var dataRate = GetDataRate();
            var firstRecordTime = GetTimeStamp();
            var doesBodyHasTimeStamp = GetTimeStampStatus();
            var idType = GetIdType();
            if (idType < 0 || idType > 3) {
                return null;
            }
            var analogMeasIds = GetAnalogMeasIds(idType);
            var valuesPerAnalogMeas = GetValuesPerAnalogMeas();
            var digitalMeasIds = GetDigitalMeasIds(idType);
            var statusId = GetStatusId();

            _data = {};
            var frameCounter = 0;

            while (_offset < buffSize) {
                var timeStamp = GetTimeStamp(dataRate, firstRecordTime, doesBodyHasTimeStamp, frameCounter);

                GetAnalogMeasValues(analogMeasIds, valuesPerAnalogMeas, statusId, timeStamp);

                GetDigitalMeasValues(digitalMeasIds, statusId);

                frameCounter++;
            }
        }
        catch (err) {
            return null;
        }

        return _data;
    }

/// <summary>
/// Extracts time stamp from the body
/// </summary>
/// <param name="dataRate"></param>
/// <param name="firstRecordTime"></param>
/// <param name="doesBodyHasTimeStamp"></param>
/// <param name="frameCounter"></param>
/// <returns></returns>
    function GetTimeStamp(dataRate, firstRecordTime, doesBodyHasTimeStamp, frameCounter) {
        var timeStamp;

        if (doesBodyHasTimeStamp) {
            timeStamp = GetTimeStamp();
            //_logger.WriteTimestamp(timeStamp);
        }
        else {
            // Timestamp = First data record timestamp + (20 * record number).
            timeStamp = firstRecordTime.AddSeconds(frameCounter * 1.0 / Math.Abs(dataRate));
            //_logger.Write("Calculated TimeStamp: ", timeStamp.ToString(CultureInfo.InvariantCulture));
        }

        return timeStamp;
    }

    var qualityPosition = 6;
    var badData = 192;
    var suspectData = 64;
    var replacedData = 128;
    var PMUErrorPosition = 3;
    var PMUSyncPosition = 2;

/// <summary>
/// Extract analog values
/// </summary>
/// <param name="analogMeasIds"></param>
/// <param name="valuesPerAnalogMeas"></param>
/// <param name="statusIdentifier"></param>
/// <param name="timeStamp"></param>
    function GetAnalogMeasValues(analogMeasIds, valuesPerAnalogMeas, statusIdentifier, timeStamp) {
        // Parse analog vaues
        analogMeasIds.forEach(function (measurement) {
            var qualityStatus = "good";
            var qualityReason = "none";

            if (statusIdentifier > 0) {
                if (statusIdentifier == 1) {
                    var statusbyte = ReadByte();
                    qualityStatus = GetQualityStatus(statusbyte);
                    qualityReason = GetQualityReason(statusbyte);

                    // TODO : save the status byte
                    //string bits = Convert.ToString(statusbyte, 2).PadLeft(8, '0');
                    //_logger.Write("StatusByte (1 byte): ", bits);
                }
                // Value presense / absence bits and bytes
                else if (statusIdentifier == 2) {
                    // The number of bytes is determined from the number of values per measurement, V, as
                    //     1 + Floor((V – 1) / 8)
                    // where Floor() means 'the highest integer not exceeding'.
                    var nofBytes = 1 + Math.floor((valuesPerAnalogMeas - 1) / 8);
                    _offset += nofBytes;
                }
                // Combination of 1 and 2
                else if (statusIdentifier == 3) {
                    var statusbyte = ReadByte();
                    qualityStatus = GetQualityStatus(statusbyte);
                    qualityReason = GetQualityReason(statusbyte);

                    var nofBytes = 1 + Math.floor((valuesPerAnalogMeas - 1) / 8);
                    _offset += nofBytes;
                }
            }

            var values = [];

            for (var i = 0; i < valuesPerAnalogMeas; i++) {
                values[i] = GetAnalogMeasValue();
            }

            var pmuData = {
                timeStamp: timeStamp,
                values: values,
                qualityStatus: qualityStatus,
                qualityReason: qualityReason
            };

            var list = [];
            if (_data[measurement]) {
                _data[measurement].push(pmuData);
            } else {
                list.push(pmuData);
                _data[measurement] = list;
            }
        })

    }

    function GetQualityReason(statusbyte) {
        if ((statusbyte & (01 << PMUErrorPosition)) != 0) {
            return "PMUError";
        }
        else if ((statusbyte & (01 << PMUSyncPosition)) != 0) {
            return "PMUSync";
        }
        return "none";
    }

    function GetQualityStatus(statusbyte) {
        if ((statusbyte & (11 << qualityPosition)) == badData)
            return "garbage";
        else if ((statusbyte & (01 << qualityPosition)) == suspectData)
            return "suspect";
        //else if ((statusbyte & (10 << qualityPosition)) != replacedData)
        return "good";
    }

/// <summary>
/// Extract digital values
/// </summary>
/// <param name="digitalMeasId"></param>
/// <param name="statusIdentifier"></param>
    function GetDigitalMeasValues(digitalMeasId, statusIdentifier) {
        var valuesPerDigitalMeas = 1;

        for (var i = 0; i < digitalMeasId; i++) {
            var digitalMeasurement = digitalMeasId[i];
            if (statusIdentifier > 0) {
                if (statusIdentifier == 1) {
                    var statusbyte = ReadByte();
                    // TODO : save the status byte
                    //string bits = Convert.ToString(statusbyte, 2).PadLeft(8, '0');
                    //_logger.Write("StatusByte (1 byte): ", bits);
                }
                // Value presense / absence bits and bytes
                else if (statusIdentifier == 2) {
                    // The number of bytes is determined from the number of values per measurement, V, as
                    //     1 + Floor((V – 1) / 8)
                    // where Floor() means 'the highest integer not exceeding'.
                    var nofBytes = 1 + Math.floor((valuesPerDigitalMeas - 1) / 8);
                    _offset += nofBytes;
                }
                // Combination of 1 and 2
                else if (statusIdentifier == 3) {
                    statusbyte = ReadByte();
                    var nofBytes = 1 + Math.floor((valuesPerDigitalMeas - 1) / 8);
                    _offset += nofBytes;
                }
            }

            var digitalValue = ReadByte();
        }
    }

/// <summary>
/// Gets the version number of the binary format
/// </summary>
/// <returns></returns>
    function GetVersion() {
        var version = ReadByte();

        return version;
    }

/// <summary>
/// Gets the rate for data records
/// </summary>
/// <returns></returns>
    function GetDataRate() {
        var dataRate = ReadByte();

        return dataRate;
    }

/// <summary>
/// Gets the timestamp of the first data record
/// </summary>
/// <returns></returns>
    function GetTimeStamp() {
        var temp = ReadBytes(8);

        var msec = new Uint64BE(temp);

        var timeStamp = new Date(msec);

        return timeStamp;
    }

/// <summary>
/// Gets True if a timestamp is included in the body for each data record. False if no timestamps are included in the body
/// </summary>
/// <returns></returns>
    function GetTimeStampStatus() {
        var hasTimeStamp = ReadBytes(1) == 0 ? false : true;

        return hasTimeStamp;
    }

/// <summary>
/// Gets analog and digital measurement ID type
/// </summary>
/// <returns></returns>
    function GetIdType() {
        var idType = ReadByte();

        return idType;
    }

/// <summary>
/// Gets the analog measurement id based on the id type
/// </summary>
/// <param name="idType"></param>
/// <returns></returns>
    function GetAnalogMeasIds(idType) {
        var numOfAnalogMeas = GetNumOfMeasurements();

        return GetMeasurementIds(idType, numOfAnalogMeas);
    }

/// <summary>
/// Gets values Per Analog Measurement
/// </summary>
/// <returns></returns>
    function GetValuesPerAnalogMeas() {
        var valuesPerAnalogMeas = ReadByte();
        return valuesPerAnalogMeas;
    }

/// <summary>
/// Gets the digital measurement id based on the id type
/// </summary>
/// <param name="idType"></param>
/// <returns></returns>
    function GetDigitalMeasIds(idType) {
        var numOfDigitalMeas = GetNumOfMeasurements();

        return GetMeasurementIds(idType, numOfDigitalMeas);
    }

/// <summary>
/// Gets the status identifier
/// </summary>
/// <returns></returns>
    function GetStatusId() {
        var statusId = ReadByte();

        return statusId;
    }

/// <summary>
/// Gets the number of analog/digital measurements
/// </summary>
/// <returns></returns>
    function GetNumOfMeasurements() {
        var temp = Buffer.from(ReadBytes(2));

        return temp.readUInt16BE(0);
    }

    function GetAnalogMeasValue() {
        var measValue = ReadSingleBigEndian(_dataBytes, _offset);
        _offset += 4;

        return measValue;
    }

/// <summary>
/// Gets the analog/digital measurement id based on the id type
/// </summary>
/// <param name="idType"></param>
/// <param name="numOfAnalogMeas"></param>
/// <returns></returns>
    function GetMeasurementIds(idType, measurementsCount) {
        var measurementIds = [];
        if (idType == 0) {
            measurementIds = GetMrIds(measurementsCount);
        }
        else if (idType == 1) {
            measurementIds = GetIIds(measurementsCount);
        }
        else if (idType == 2) {
            measurementIds = GetPdxIds(measurementsCount);
        }
        else if (idType == 3) {
            measurementIds = GetModeIds(measurementsCount);
        }

        return measurementIds;
    }

/// <summary>
/// Gets the Mode ids
/// </summary>
/// <param name="numOfAnalogMeas"></param>
/// <returns></returns>
    function GetModeIds(numOfAnalogMeas) {
        var modeIDs = [];

        for (var i = 0; i < numOfAnalogMeas; i++) {
            var pdxType = ReadByte();
            var modeID = ReadByte();
            var modeType = ReadByte();

            var modeTypeString = modeType == 0 ? "f" : modeType == 1 ? "d" : "";
            var pdxID = [pdxType, modeID, modeTypeString].join(".");
            modeIDs.push(pdxID);

        }
        return modeIDs;
    }

/// <summary>
/// Gets the PDX ids
/// </summary>
/// <param name="numOfAnalogMeas"></param>
/// <returns></returns>
    function GetPdxIds(numOfAnalogMeas) {
        var pdxIDs = [];

        for (var i = 0; i < numOfAnalogMeas; i++) {
            var temp = Buffer.from(ReadBytes(4));
            var iid = temp.readUInt32BE(0);
            var pdxType = ReadByte();
            var modeID = ReadByte();
            var modeType = ReadByte();

            var modeTypeString = modeType == 0 ? "f" : modeType == 1 ? "d" : modeType == 2 ? "a" : "";
            var pdxID = [iid, pdxType, modeID, modeTypeString].join(".");
            pdxIDs.push(pdxID);

        }
        return pdxIDs;
    }

/// <summary>
/// Gets the IIDs
/// </summary>
/// <param name="numOfAnalogMeas"></param>
/// <returns></returns>
    function GetIIds(numOfAnalogMeas) {
        // IID 4 bytes
        var iIds = [];
        for (var i = 0; i < numOfAnalogMeas; i++) {
            var temp = Buffer.from(ReadBytes(4));
            var id = temp.readUInt32BE(0);
            iIds.push(id);
        }
        return iIds;
    }

/// <summary>
/// Gets the MRIDs
/// </summary>
/// <param name="numOfAnalogMeas"></param>
/// <returns></returns>
    function GetMrIds(numOfAnalogMeas) {
        // this implemenation is wrong and not used in URTDSM
        // MRID 16 bytes
        var mrids = [];
        for (var i = 0; i < numOfAnalogMeas; i++) {
            var temp = ReadBytes(16);
            var mrId = (temp).toString();
            mrids.push(mrId);
        }
        return mrids;
    }

/// <summary>
/// Read single byte from byte array
/// </summary>
/// <param name="bytearray"></param>
/// <param name="pos"></param>
/// <returns></returns>
    function ReadByte() {
        return _dataBytes[_offset++];
    }

/// <summary>
/// Read specified number of bytes from byte array
/// </summary>
/// <param name="size"></param>
/// <returns></returns>
    function ReadBytes(size) {
        var temp = [];
        for (var i = 0; i < size; i++) {
            temp[i] = _dataBytes[_offset + i];
        }
        _offset += size;
        return temp;
    }

/// <summary>
/// Converts the Java big endian UUID to little endian UUID
/// </summary>
/// <param name="Guid"></param>
/// <returns></returns>
    function ToLittleEndian(guid) {
        // this function is not used in this javascript project
        var net = [];
        var java = guid.ToByteArray();
        for (var i = 8; i < 16; i++) {
            net[i] = java[i];
        }

        net[0] = java[3];
        net[1] = java[2];
        net[2] = java[1];
        net[3] = java[0];

        net[4] = java[5];
        net[5] = java[4];
        net[6] = java[7];
        net[7] = java[6];
        return new guid(net);
    }

/// <summary>
/// UNIX time epoch
/// </summary>
    var UnixEpoch = new Date(1970, 1, 1, 0, 0, 0, 0);

/// <summary>
/// Calculate time (using milliseconds) from UNIX epoch
/// </summary>
/// <param name="milliseconds"></param>
/// <returns></returns>
    function FromMillisecondsSinceUnixEpoch(milliseconds) {
        return UnixEpoch + milliseconds;
    }

/// <summary>
/// Reads a float value from the byte array in big endian format and converts to little endian.
/// </summary>
/// <param name="data"></param>
/// <param name="offset"></param>
/// <returns></returns>
    function ReadSingleBigEndian(data, offset) {
        return data.readFloatBE(offset);
    }
}