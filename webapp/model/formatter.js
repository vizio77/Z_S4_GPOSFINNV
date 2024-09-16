sap.ui.define(["sap/ui/core/format/DateFormat",
	"sap/ui/core/format/NumberFormat"
], function(DateFormat, NumberFormat) {
	"use strict";
	return {

		valueForAps: function(sNum) {

			var oFormatOptions = {
			maxFractionDigits: 2,
			groupingEnabled: true,
			groupingSeparator: ".",
			decimalSeparator: ","
		};
		if (sNum !== "" && sNum !== undefined) {
				var oFloatFormat = NumberFormat.getFloatInstance(oFormatOptions);
				return oFloatFormat.format(sNum);
		}
			
		},

		formatterStato: function(sValueStato, sFlagCanc) {
			switch (sValueStato) {
				case "D":
					return "Definitivo";
				case "P":
					if (sFlagCanc === "X") return "Provvisorio/Cancellato";
					return "Provvisorio";
				case "B":
					if (sFlagCanc === "X") return "Bozza/Cancellato";
					return "Bozza";
			}
		},
		formatterTipo: function(sValue) {
			switch (sValue) {
				case "U":
					return "UCB";
				case "R":
					return "RTS";
			}
			return sValue;
		},
		formatterDateForDB: function(dDate) {
			return this.formatterDatePatter(dDate, 1);
		},
		formatterDatePatter: function(dDate, sMod) {
			switch (sMod) {
				case 0:
					var sPatter = "yyyyMMdd";
					break;
				case 1:
					sPatter = "PTHH'H'mm'M'ss'S'";
					break;
			}
			var timeFormat = sap.ui.core.format.DateFormat.getTimeInstance({
				pattern: sPatter
			});
			return timeFormat.format(dDate);
		},

		formatterColStrumento: function(sTipoStr, sNumeroStr, sTipoSStr, sNumeroStrr, sVersione) {
			if (sVersione === "D" || sVersione === "B" || (sNumeroStr === "" && sNumeroStrr === "")) {
				return "";
			} else {
				return sTipoStr + " - " + sNumeroStr + " - " + sTipoSStr + " - " + sNumeroStrr;
			}

		},
		formatterNumber: function(sValue) {
			if (sValue === undefined) {
				return "";
			}
			var sReturn = sValue.match("^[0-9]*$") === null ? '' : sValue;
			return sReturn;
		},
		formatterReale: function(sValue) {
			if (sValue.includes("S")) {
				return "Simulato";
			} else if (sValue.includes("B")) {
				return "Bozza";
			} else if (sValue.includes("R")) {
				return "Reale";
			}
		},
		formatterDatePickerParse: function(dDate, sMod) {
			switch (sMod) {
				case 0:
					var sPatter = "yyyyMMdd";
					break;
				case 1:
					sPatter = "PTHH'H'mm'M'ss'S'";
					break;
				case 2:
					sPatter = "dd.MM.yyyy";
					break;
			}
			var timeFormat = sap.ui.core.format.DateFormat.getTimeInstance({
				pattern: sPatter
			});
			return timeFormat.parse(dDate);
		},

		formatterDateFormat: function(dDate, sMod) {
			switch (sMod) {
				case 0:
					var sPatter = "yyyyMMdd";
					break;
				case 1:
					sPatter = "PTHH'H'mm'M'ss'S'";
					break;
				case 2:
					sPatter = "dd.MM.yyyy";
					break;
				case 3:
					sPatter = "HHmmss";
					break;
			}
			var timeFormat = sap.ui.core.format.DateFormat.getTimeInstance({
				pattern: sPatter
			});
			return timeFormat.format(dDate);
		},

		formatterDateParse: function(dDate, sMod) {
			switch (sMod) {
				case 0:
					var sPatter = "yyyyMMdd";
					break;
				case 1:
					sPatter = "PTHH'H'mm'M'ss'S'";
					break;
				case 2:
					sPatter = "dd.MM.yyyy";
					break;
				case 3:
					sPatter = "yyyy-MM-dd";
					break;
			}
			var timeFormat = sap.ui.core.format.DateFormat.getTimeInstance({
				pattern: sPatter
			});
			return timeFormat.parse(dDate);
		},

		formatterOptionFloat: function(sNum) {

			// if (parseInt(sNum).toString().length > 3) {
			// 	var oFloatFormatReturn = "0,00";
			// } else {
			try {
				sNum = sNum.toString().replaceAll(".", "");
				var oLocale = new sap.ui.core.Locale("it-IT");
				var oFormatOptions = {
					"minIntegerDigits": 1,
					"maxIntegerDigits": 20,
					"minFractionDigits": 2,
					"maxFractionDigits": 2
				};
				var oFloatFormat = NumberFormat.getFloatInstance(oFormatOptions, oLocale);
				var oFloatFormatReturn;
				if (sNum.includes(",")) {

					var aTemp = sNum.split(",");
					var sIntergerPart = aTemp[0].replace(".", "");
					var sDecimalPart = aTemp[1];
					if (sIntergerPart === "") {
						sIntergerPart = "0";
					}
					if (sDecimalPart !== "") {
						sDecimalPart = "";
					} 
					if (sDecimalPart === "") {
						sDecimalPart = "0";
					}
					/* if (sDecimalPart === "") {
						sDecimalPart = "0";
					} */
					oFloatFormatReturn = sIntergerPart + "." + sDecimalPart;
					oFloatFormatReturn = oFloatFormat.format(oFloatFormatReturn);
				} else {
					oFloatFormatReturn = oFloatFormat.format(sNum);
				}
				// }
			} catch (error) {
				oFloatFormatReturn = "0,00";
			}
			return oFloatFormatReturn;
		},

		formatterRange: function(sVal) {
			var aRes;
			var regex = /^\d{1,3}(\.\d{3})*(,\d{2})?$/;
			if (regex.test(sVal) === false) {
				aRes = "";
			} else {
				aRes = sVal;
			}
			return aRes;
		}
	};
});