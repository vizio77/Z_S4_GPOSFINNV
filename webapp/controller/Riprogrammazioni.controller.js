sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"../model/formatter",
	"sap/ui/core/Fragment",
	"sap/m/MessageBox",
	"sap/ui/core/routing/History",
	"./Finanziamento.controller",
	"sap/ui/core/BusyIndicator"
], function(Controller, JSONModel, Filter, FilterOperator, formatter, Fragment, MessageBox, History, Finanziamento, BusyIndicator) {
	"use strict";

	return Finanziamento.extend("zsap.com.r3.cobi.s4.gestposfinnv.controller.Riprogrammazioni", {
		formatter : formatter,
		/**
		 * @override
		 */
		
		onInit: async function() {
            var oRouter = this.getOwnerComponent().getRouter();
			this.getView().addEventDelegate({
				onBeforeHide: (oEvent) => {
					const modelPosFin = this.getOwnerComponent().getModel("modelPosFin")
					modelPosFin.setProperty("/",{
						formPosFin: {},
						posFinHelp: {},
						elencoPosFin: [],
						detailAnagrafica: {}
					})
					// let oRimVerticaliSac = this.getView().byId("linkSac")
					// document.getElementById(oRimVerticaliSac.getId()).setAttribute("src", "")
				}
			})
			oRouter.getRoute("Riprogrammazioni").attachPatternMatched(this._onObjectMatched, this);
        },
        _onObjectMatched: async function (oEvent) {
			this.getView().setBusy(true)
			const oKeySStr = oEvent.getParameter("arguments")
			var oAuth = await this.getAuth(oKeySStr);
            this.getView().setModel(new JSONModel({
                infoSottoStrumento: {},
                tablePosFinRicCed: [],
                Anno: null,
                visibleRiceCede: false,
				disableModificaRicerca: false,
                formCedenteRicevente: {}
            }), "finanziamento")
			this.getOwnerComponent().setModel(new JSONModel({
                formPosFin: {},
                posFinHelp: {
					posFin: {
						Fipex: ""
					}
				},
                elencoPosFin: [],
				Fincode: oKeySStr.Fincode,
				Auth: oAuth,
				AuthDesc: oAuth.ZzdescrEstesaFm,
				elencoPosFin: [],
				Finanziamento:{
					Amministrazione: {
						DescrizioneAmministrazioneLunga : "",
						DescrizioneAmministrazione : ""
					},
					CodingBlocks: [],
					PosFin: []
				},
				formAutorizzazione: {
					"Item": {}
				},
				detailAnagrafica: {}
            }),"modelPosFin");
			
			let sAnnoFase = await this.__getAnnoFase()

			this.getView().setModel(new JSONModel({visible : true, AllineaCassa : false}),"modelRip")
			//await this.checkControlli(oKeySStr)
			await this.__getAnnoFaseProcessoMacroFase()
			await this.__getSottoStrumento(oKeySStr, sAnnoFase)
			await this.getPosFin(oKeySStr)
			//await this.setUrlSac();
		},
		checkControlli: async function (oKeySStr) {
				var controlloAutorizzazione = false
				const oModelVarCont = this.getOwnerComponent().getModel("modemVarCont")

				this.getView().setModel(new JSONModel({visible : true, AllineaCassa : false}),"modelRip")
							
				var controllo = {
					"Fincode" : oKeySStr.Fincode,
					"IDcontrollo" : "00191", //DA MODIFICARE IN BASE ALLE INFO DEI CONTROLLI 00191
					"TypeKey" : "GEST_POSFIN",
					"Fikrs" : "S001",
					"CodiceStrumento" :  oKeySStr.CodiceStrumento,
					"CodiceSottostrumento" : oKeySStr.CodiceSottostrumento,
					"CodiceStrumentoori" : oKeySStr.CodiceStrumentoOri,
					"Schermata" : "RIP_COMPETENZA", //DA MODIFICARE IN BASE ALLE INFO DEI CONTROLLI RIP REF DIF _COMPETENZA
					"Ambito" : "SPESA",
					"VERSIONE" : "",
					"ANNO" : "",
					"REALE" : "",
					"FIPEX" : "",
					"FICTR" : "" 
				}
				
				this.getView().setBusy(true)
				
				var invio  = await this.__setDataPromiseSaveBW( "/Controllo_FLSet" ,oModelVarCont, {}, controllo)
				//invio.success = true
				if(!invio.success){
					if(invio.error && invio.error.statusCode === "404" && invio.error.responseText){
						const message = JSON.parse(invio.error.responseText)
						if(message && message.error && message.error.message){
							MessageBox.error(message.error.message.value)
							this.getView().setBusy(false)
							controlloAutorizzazione = false
						}else{
							MessageBox.error("Errore di comunicazione")
							this.getView().setBusy(false)
							controlloAutorizzazione = false
						}
					}else{
						MessageBox.error("Errore di comunicazione")						
						controlloAutorizzazione = false
					} 
				}else{
					controlloAutorizzazione = true
					this.getView().setBusy(false)
				}
				
				this.getView().getModel("modelRip").setProperty("/visible" , controlloAutorizzazione)
				
		},

		/**
		 * 
		 * 
		 * @param {object} oKeySStr  
		 * @public
		 */
		getAuth: function (oKeySStr) {
			const modelPosFin = this.getView().getModel("modelPosFin");
			const modelHana = this.getOwnerComponent().getModel("sapHanaS2Revisione")
			let aFilters= [
				new Filter("Fikrs", FilterOperator.EQ, "S001"),
				new Filter("Fincode", FilterOperator.EQ, oKeySStr.Fincode)
			]
			return new Promise ((success, error) => {
				modelHana.read("/NuovaAutorizzazioneSet", {
					urlParameters: {
						$expand: "AmminCompetenza"
					},
					filters: aFilters,
					success: (oData) => {
						success(oData.results[0])
					},
					error: (res) => {
						error()
					}
				})
			})
		},

		checkDecVsPluri: function(isCassa){
			const modelRow = !isCassa ? "modelTableSac" : "modelTableSacCa"
			var modelPluri = this.getView().getModel("modelPluri");
			var modelTSac = this.getView().getModel(modelRow);
			var modelPluriData = modelPluri.getData()
			var modelTSacData = modelTSac.getData()
			var rowTriennio = modelTSacData[0]
			let ritorno = true

			if(rowTriennio.FLAG_A_DECORRERE){
				if(modelPluriData && modelPluriData.NAV_PLUR && modelPluriData.NAV_PLUR.length > 0) {
					ritorno = false
				}
			}
			if(!ritorno) MessageBox.warning(`Operazione non consentita. Sono indicati contemporaneamente A decorrere e Pluriennali`)
			return ritorno
		},
		onSavePluriennale: async function(oEvent) {
			const oModelVarCont = this.getOwnerComponent().getModel("modemVarCont")
			const allineaCassa = this.getView().getModel("modelRip").getProperty("/AllineaCassa")
			
			var somma = this.checkSommaEqZero(allineaCassa)


			var oPayload = {
				...somma.Payload[0],
				Fipex : "",
				Importo : "0",
				AnnoA: "",
				AnnoDa: "",
				Ricorrenza: "",
				Fictr: "",
				UPDATEDEEPRIPROG : somma.Payload
			}


			//se rimodulazioni orizzontali controllo che la somma di tutti i valori diano 0 altrimenti do errore
			if(!somma.Check){
				MessageBox.warning(`La somma degli importi riprogrammati deve essere uguale a 0,00`)
				return
			}

			//! LT -> mando i $ nell'oData per imputare i dati
			console.log("vado a creare il payload:", oPayload)

			//TODO creo il payload per come lo vogliono


			MessageBox.show(
				this.recuperaTestoI18n("confermaSalvataggio"), {
					icon: MessageBox.Icon.INFORMATION,
					title: "Salvataggio ",
					actions: [MessageBox.Action.YES, MessageBox.Action.NO],
					emphasizedAction: MessageBox.Action.YES,
					onClose:async function  (oAction) { 
						if(oAction === "YES"){
							//Salvataggio 
							//TODO Creare Payload
							//!lt controllo i tre anni e il modello pluri
							sap.ui.core.BusyIndicator.show();	
							var path = "/RiprogrammazioniSet"
							const invio  = await this.__setDataPromiseSaveBW( path ,oModelVarCont, {}, oPayload)		
							sap.ui.core.BusyIndicator.hide()
							if(invio.success) {
								MessageBox.success("Operazione eseguita con successo")
								//TODO reset modello pluri
								this.creaStrutturaRiprogrammazioni()
							}else{
								if(invio.error && invio.error.statusCode === "404" && invio.error.responseText){
									const message = JSON.parse(invio.error.responseText)
									if(message && message.error && message.error.message){
										MessageBox.error(message.error.message.value)
										return
									}
									MessageBox.error("Errore di comunicazione")
								} 
								MessageBox.error("Errore di comunicazione")
							}
						}
					}.bind(this)
				}
			);

		},

		onPressResetta: function (oEvent) {
			let obj = oEvent.getSource().getBindingContext("modelRiprogrammazioni").getObject()
			const path = oEvent.getSource().getBindingContext("modelRiprogrammazioni").getPath()
			obj.VAL_ANNO1 = "0,00"
			obj.VAL_ANNO2 = "0,00"
			obj.VAL_ANNO3 = "0,00"
			
			this.getView().getModel("modelRiprogrammazioni").setProperty(path, obj)
			
		},

		checkSommaEqZero: function(allineaCassa){

			var modelRip = this.getView().getModel("modelRiprogrammazioni");
			var modelRipData = modelRip.getData()
			var payload = []

			this.getView().getModel(new JSONModel(),"modelPayload")
			
			var somma = 0
			for (let z = 0; z < modelRipData.length; z++) {
				const row = modelRipData[z];
				let valore = 0 
				//lt come prima cosa recupero i valori del triennio	e li sommo		
					for (let i = 1; i <= 3; i++) {
						if(row[`VAL_ANNO${i}`] === "0,00") continue
						let valore = parseInt(row[`VAL_ANNO${i}`].replace(",00","").replaceAll(".", ""))

						var valori = {
							Importo : row[`VAL_ANNO${i}`].replace(",00","").replaceAll(".", ""),
							AnnoDa : row[`ANNO${i}`].toString(),
							AnnoA : "",
							// Decorrere : flagADecorrere,
							AllineaCassa : allineaCassa
						}
						payload.push(this.createPayloadVar(valori, row))
						
						somma = somma + valore
					}

					//somma = somma + valore

					//! lt gestisto la popup dei plurienni
					let sommaPluriennio = this.sommaPluriennio(row, payload, allineaCassa)

					payload = sommaPluriennio.Payload

					somma = somma + sommaPluriennio.Somma
	
				}
				
				

				return { Check : somma === 0 ? true : false , Payload : payload}
		},
		sommaPluriennio: function(rowPl, payload, allineaCassa){

			const navPlur = rowPl.Pluriennali.NAV_PLUR
			let somma = 0
			//TODO metodo per impostare valori per i pluriennali
			navPlur.forEach(row => {
				//se presente dal al devo fare le somme...
				 if(row.annoAl){
					//prendo gli anni dal al e faccio 
					let annoDa = parseInt(row.annoDal)
					let annoA = parseInt(row.annoAl)
					let ricorrenza = parseInt(row.ricorrenza) 
					if((annoDa - annoA) === 0) {
						somma = somma + parseInt(row.importo)
						var valori = {
							Importo : row.importo.replace(",00","").replaceAll(".", ""),
							AnnoDa : annoDa.toString(),
							AnnoA : "",							
							// Decorrere : flagADecorrere,
							AllineaCassa : allineaCassa
						}
						payload.push(this.createPayloadVar(valori, rowPl))
					}else{
						//lt calcolo l'intervallo degli anni
							if(ricorrenza === 0) ricorrenza = 1

							var valori = {
								Importo : row.importo.replace(",00","").replaceAll(".", ""),
								AnnoDa : annoDa.toString(),
								AnnoA : annoA.toString(),
								Ricorrenza : ricorrenza.toString(),
								// Decorrere : flagADecorrere,
								AllineaCassa : allineaCassa
							}

							payload.push(this.createPayloadVar(valori, rowPl))
							//!lt creo per ogni anno dei pluriennali le righe
							for (let z = annoDa; z <= annoA; z ) {
								//payload.push({ annoDal : z.toString() , importo: parseInt(row.importo)})
								somma = somma + parseInt(row.importo)
								z = z + ricorrenza
							}
					} 
				}/* else{
					somma = somma + parseInt(row.importo)
				} */
			});
			return {Somma : somma , Payload : payload}
		
		},
		createPayloadVar: function(valori, row){
			const esercizio = this.getView().getModel("globalModel").getProperty("/ANNO")
			const modelPosFin = this.getOwnerComponent().getModel("modelPosFin")
			const oSottostrumento = modelPosFin.getProperty("/infoSottoStrumento")
			
		
			//debugger
			let payload = {
				"Fikrs" : "S001",
				"Anno" : esercizio,
				"Fase" : row.Fase,
				"Reale" : "R",
				"Versione" : row.Versione,
				"Fipex" : row.Fipex,
				"Fictr" : row.Fictr,
				"Fincodecoll" : "",
				"Fincode" : row.IdAutorizzazione,
				"Importo" : !valori.Importo ? "0" : valori.Importo,
				"CodiceStrumento" : oSottostrumento.CodiceStrumento,
				"CodiceStrumentoOri" : oSottostrumento.CodiceStrumentoOri,
				"CodiceSottostrumento" : oSottostrumento.CodiceSottostrumento,
				"AnnoDa" : !valori.AnnoDa ? "" : valori.AnnoDa,
				"AnnoA" : !valori.AnnoA ? "" : valori.AnnoA,
				"Capitolo" : row.Capitolo,
				"Eos" : "S"
			}
				payload.Decorrere = !valori.Decorrere ? false : true
				payload.AllineaCassa = !valori.AllineaCassa ? false : true
				payload.Ricorrenza = !valori.Ricorrenza ? "" : valori.Ricorrenza
			
			return payload
		},

		/**
		 * @public
		 */
		setUrlSac: async function (oPosFin) {
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			const modelPosFin = this.getOwnerComponent().getModel("modelPosFin")
			var aPosFin = modelPosFin.getProperty("/elencoPosFin");
			var oAuth = modelPosFin.getProperty("/Auth");
			var sAttivo = "1";
			const sEsposizione = modelPosFin.getProperty("/infoSottoStrumento/TipoEsposizione");
			if (sEsposizione !== "9") {
				const aCheckRuolo = await this.__getDataPromise("/CHECK_ENTITY_RUOLOSet",
									[
										new Filter("Attore", FilterOperator.EQ, "MEF:B:M000:COBI:GEST_TECNICA"),
										new Filter("IdControllo", FilterOperator.EQ, "00001"),
										new Filter("TypeKey", FilterOperator.EQ, "GEST_POSFIN"),
										new Filter("Ambito", FilterOperator.EQ, "SPESA"),
										new Filter("Schermata", FilterOperator.EQ, "RIPROGRAMMAZIONE")
								], modelHana);
				if(aCheckRuolo.length > 0) {
					if(oAuth.Classificazione != "FL" && aCheckRuolo[0].AttDisattivo == 'X'){
						MessageBox.warning(aCheckRuolo[0].Operazione) //OPERAZIONE NON CONSENTITA. PER AUTORIZZAZIONE CON CLASSIFICAZIONE DIVERSA DA 'FL' NON SONO PERMESSE OPERAZIONI CONTABILI. PER POTER OPERARE CONTATTARE IL COORDINAMENTO UFFICIO II
						sAttivo = "0"
					}
				} else {
					if(oAuth.Classificazione != "FL"){
						MessageBox.warning("OPERAZIONE NON CONSENTITA. PER AUTORIZZAZIONE CON CLASSIFICAZIONE DIVERSA DA 'FL' NON SONO PERMESSE OPERAZIONI CONTABILI. PER POTER OPERARE CONTATTARE IL COORDINAMENTO UFFICIO II") //OPERAZIONE NON CONSENTITA. PER AUTORIZZAZIONE CON CLASSIFICAZIONE DIVERSA DA 'FL' NON SONO PERMESSE OPERAZIONI CONTABILI. PER POTER OPERARE CONTATTARE IL COORDINAMENTO UFFICIO II
						sAttivo = "0"
					}
				}
			}
			var oStrutturaAmmRes = {};
				this.getView().setBusy(true)
				if (oPosFin != null) {
					aPosFin = [oPosFin];
				}
					var aVarMulti = aPosFin.map(async (oPosFin) => {
						oStrutturaAmmRes = await this._getEntitySet("/StrutturaAmministrativaCentraleSet",
							[
								new Filter("Fikrs", FilterOperator.EQ, oPosFin.Fikrs),
								new Filter("Fase", FilterOperator.EQ, oPosFin.Fase),
								new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
								new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
								new Filter("Eos", FilterOperator.EQ, oPosFin.Eos),
								new Filter("Datbis", FilterOperator.GE,  new Date()),
								new Filter("Prctr", FilterOperator.EQ, oPosFin.Prctr),
								new Filter("CodiceCdr",FilterOperator.EQ, oPosFin.Cdr),
								new Filter("CodiceRagioneria", FilterOperator.EQ, oPosFin.Ragioneria),
								new Filter("CodiceUfficio", FilterOperator.EQ, '0000')
							]
							,modelHana)
						return {
							SemObj : "GEST_POSFIN",
							Schermata: "RIPROGRAMMAZIONi",
							IdPosfin: oPosFin.Fipex,
							IdStAmmResp: oStrutturaAmmRes["/StrutturaAmministrativaCentraleSet"].Fictr,
							CodiFincode: modelPosFin.getProperty("/Fincode"),
							Anno: modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr"),
							CodiceStrumento: modelPosFin.getProperty("/infoSottoStrumento/CodiceStrumento"),
							CodiceStrumentoOri: modelPosFin.getProperty("/infoSottoStrumento/CodiceStrumentoOri"),
							CodiceSottostrumento: modelPosFin.getProperty("/infoSottoStrumento/CodiceSottostrumento"),
						}
					})
				Promise.allSettled(aVarMulti).then((aResponse) => {
					let payload = {
						SemObj: "GEST_POSFIN",
						Schermata: "RIPROGRAMMAZIONI",
						VarMulti: aResponse.map((oResponse) =>{
							return oResponse.value;
						})
					}
					modelHana.create("/SacUrlSet", payload,{
						success:  (oData, res) => {
							//debugger
							this.getView().setBusy(false)
							let oProgrammazioniSac = this.getView().byId("RiprogrammazioneSac");
							oData.Url += "/?&&p_Attivo=" + sAttivo;
							document.getElementById(oProgrammazioniSac.getId()).setAttribute("src", oData.Url);
							// window.frames[0].location = oData.Url + (new Date());
						},
						error: (res) => {
							//debugger
							this.getView().setBusy(false)
							return MessageBox.error("Errore")
						}
					})
				})
		},

		getPosFin: async function (oKeySStr) {
			const modelPosFin = this.getView().getModel("modelPosFin");
			const sEsposizione = modelPosFin.getProperty("/infoSottoStrumento/TipoEsposizione");
			const modelHana = this.getOwnerComponent().getModel("sapHanaS2Revisione")
			const modelHanaS2 = this.getOwnerComponent().getModel("sapHanaS2")
			var that = this
			var aFilters = [
				new Filter("Fincode", FilterOperator.EQ, oKeySStr.Fincode),
				new Filter("Fikrs", FilterOperator.EQ, oKeySStr.Fikrs),
				new Filter("Fase", FilterOperator.EQ, "NV"),
				new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
				new Filter("Attivo", FilterOperator.EQ, "X"),
				new Filter("Loekz", FilterOperator.EQ, ""),
				new Filter("Reale", FilterOperator.EQ, "R"),
				new Filter("ZSLUG", FilterOperator.EQ, sEsposizione)
			];
			return new Promise((success, error) => {
				modelHana.read("/CODING_BLOCKSet", {
					filters: aFilters,
					success: (oData) => {
						modelPosFin.setProperty("/Finanziamento/CodingBlocks", oData.results);
						success(oData.results);
					},
					error: (res) => {
						error(res);
					}
				})
			}).then((aData) => {
				aFilters.shift();
				aFilters.pop();
				aData.forEach(oCodingBlock => {
					aFilters.push(new Filter("Fipex", FilterOperator.EQ, oCodingBlock.Fipex))
				});
				return new Promise((success, error) => {
					modelHanaS2.read("/PosizioneFinanziariaSet", {
						filters: aFilters,
						success: (oData) => {
							success(oData.results);
						},
						error: (res) => {
							error(res);
						}
					})
				});
			}).then(async (aData) => {
				modelPosFin.setProperty("/elencoPosFin/", aData);
				modelPosFin.setProperty("/posFinHelp/posFin", {
					"Fipex": ""
				});
			}).finally(() => {
				that.creaStrutturaRiprogrammazioni()
				BusyIndicator.hide();
			})
		},
        async __getSottoStrumento(oKeySStr, sAnnoFase){
			const oModel = this.getOwnerComponent().getModel("sapHanaS2")
			return new Promise((success, error) => {
				oModel.read("/SottostrumentoSet",{
					filters: [
						new Filter("Fikrs", FilterOperator.EQ, oKeySStr.Fikrs),
						new Filter("CodiceStrumento", FilterOperator.EQ, oKeySStr.CodiceStrumento),
						new Filter("CodiceStrumentoOri", FilterOperator.EQ, oKeySStr.CodiceStrumentoOri),
						new Filter("CodiceSottostrumento", FilterOperator.EQ, oKeySStr.CodiceSottostrumento),
						new Filter("Datbis", FilterOperator.EQ, new Date(oKeySStr.Datbis)),
						new Filter("AnnoSstr", FilterOperator.EQ, sAnnoFase)
					],
					urlParameters: {
						$expand: "DomInterno,DomAmministrazione,DomMissione,DomTitolo"
					},
					success: (oData, res) => {
						let modelRimVerticali = this.getView().getModel("modelRimVerticali")
						const modelPosFin = this.getOwnerComponent().getModel("modelPosFin")
						modelPosFin.setProperty("/Sottostrumento", `${oData.results[0].DescTipoSstr} - ${oData.results[0].NumeroSstr}`)
						modelPosFin.setProperty("/infoSottoStrumento", oData.results[0])
						this.__getHVAmministrazione(oModel, modelPosFin, oData.results[0].DomAmministrazione)
						success(oData);
						this.getView().setBusy(false)			
					},
					error: (res) => {
						this.getView().setBusy(false)
						error(res);
					}
				})
			})
		},

		creaStrutturaRiprogrammazioni: function(){
			this.getView().setModel(new JSONModel({}),"modelPluri")
			const modelPosFin = this.getOwnerComponent().getModel("modelPosFin")
			let cb = modelPosFin.getProperty("/Finanziamento/CodingBlocks");
			const esercizio = this.getView().getModel("globalModel").getProperty("/ANNO")

			this.getView().getModel("modelRip").setProperty("/AllineaCassa",false)

			let posFin = modelPosFin.getProperty("/elencoPosFin");
			let rows = []
			let int = 0
			cb.forEach(auth => {

				let posFound = posFin.find(item => (item.Fipex === auth.Fipex))
				let struttura = {
					"CodificaRep" : posFound.CodificaRepPf,
					"Fikrs" : posFound.Fikrs,
					"Fase" : posFound.Fase,
					"Anno" : posFound.Anno,
					"Fipex" : posFound.Fipex,
					"Versione" : posFound.Versione,
					"Capitolo" : posFound.Capitolo,
					"Pg" : posFound.Pg,
					"IdAutorizzazione" : auth.Fincode,
					"Prctr" : posFound.Prctr,
					"Ammin" : posFound.Ammin,
					"Fictr" : auth.Fictr,
					"oPosFin" : posFound,
					"ANNO1" : esercizio,
					"ANNO2" : (parseInt(esercizio) + 1).toString(),
					"ANNO3" : (parseInt(esercizio) + 2).toString(),
					"VAL_ANNO1" : "0,00",
					"VAL_ANNO3" : "0,00", 
					"VAL_ANNO2" : "0,00",
					"Pluriennali" : {
										visImporti: "true",
										annoSing: "",
										path : `/modelRiprogrammazioni/${int}`,
										selectSing: false,
										selectPluri: true,
										importo: "0,00",
										NAV_PLUR: [{
											annoDal: "",
											annoAl: "",
											ricorrenza: "1",
											importo: "0,00"
										}]
					}
				}				
				rows.push(struttura)	
				int++			
			});
			
			modelPosFin.setProperty("/Riprogrammazioni", rows)
			this.getView().setModel(new JSONModel(rows), "modelRiprogrammazioni");

			//!lt creo il modello per le etichette del quadro
			const sAnno = this.getOwnerComponent().getModel("globalModel").getProperty("/ANNO")
			const annoParse = parseInt(sAnno)
			const anni = {
				annoCp1: annoParse.toString(),
				annoCp2: (annoParse+1).toString(),
				annoCp3: (annoParse+2).toString(),
				/* annoCs1: annoParse.toString(),
				annoCs2: (annoParse+1).toString(),
				annoCs3: (annoParse+2).toString(), */
			}
			this.getView().setModel(new JSONModel(anni), "labelColumn");

		},

		onPressPluriennaliRipr: function(oEvent, visImport) {
			// this._openBusyDialog("");
			const row = oEvent.getSource().getBindingContext("modelRiprogrammazioni").getObject()
			/* if(this.getView().getModel("modelPluri")){
					if(!this.getView().getModel("modelPluri").getProperty("/NAV_PLUR")) this.getView().setModel(new JSONModel(oObject),"modelPluri")
			} */
			this.getView().setModel(new JSONModel(row.Pluriennali),"modelPluri")
      //this.getView().getModel("modelPluri").setData(row.Pluriennali)

			this.getView().getModel("modelPluri").setProperty("/visImporti", visImport)
			if(!this._oDialogPlur){
				this._oDialogPlur = sap.ui.xmlfragment(
					"zsap.com.r3.cobi.s4.gestposfinnv.view.pluriennale",
					this);
					this.getView().addDependent(this._oDialogPlur);
				}
			this._oDialogPlur.open();

		},

			onClosePluriennale: function($event, annulla) {
				var check = true
				if(annulla){
						this.deleteRowsIncomplete()
				}else{
						check = this.initCheckImporti()
				}
				if(check){

					var sModel = this.getView().getModel("modelPluri");
					var modelPluriData = sModel.getData()
					const path = modelPluriData.path

					this.getView().getModel("modelRiprogrammazioni").setProperty(`${path}/Pluriennali`,modelPluriData)

						this._oDialogPlur.close();
						this._oDialogPlur.destroy();
						delete this._oDialogPlur
				}
			
		},

		openquadroCont: async function (sValue, oEvent, sPF, sCP, sCB) {
			this.getView().setBusy(true);
			this.getView().setModel(new JSONModel([{}]), "modelTableQuadro");
			const oModelQuadro = this.getOwnerComponent().getModel("ZSS4_COBI_QUADRO_CONTABILE_DLB_SRV")
			let oModelPosFin = this.getView().getModel("modelPosFin");
			let sAnno = this.getOwnerComponent().getModel("globalModel").getData().ANNO;
			//var aDataRim = this.getView().getModel("modelRimVerticali").getData().tablePosFinRicCed;
			this.getView().setModel(new JSONModel({
				Title:""
				}),"TitoloExport")
				
			var object = oEvent.getSource().getBindingContext("modelRiprogrammazioni").getObject()
			
			//var aSingRim = aDataRim.filter((word) => word.Fipex === sPF && word.Capitolo === sCP)
			if (sValue === "CAP") {
				if (sCP.length !== 0) {
					var sEntity = "/QuadroContabile(P_Disp=true,P_AreaFin='S001',P_AnnoFase='" + sAnno + "',P_AnnoMin='" + sAnno + "',P_AnnoMax='" + (parseInt(sAnno) + 2) + "',P_Fase='NV',P_Eos='S',P_PosFin='" + sPF.replaceAll(".", "") + "',P_Autorizz='',P_Capitolo='" + sCP + "',P_RecordType='OC')/Set"
				} else {
					var sEntity = "/QuadroContabile(P_Disp=true,P_AreaFin='S001',P_AnnoFase='" + sAnno + "',P_AnnoMin='" + sAnno + "',P_AnnoMax='" + (parseInt(sAnno) + 2) + "',P_Fase='NV',P_Eos='S',P_PosFin='" + oModelPosFin.getProperty("/posFin").replaceAll(".", "") + "',P_Autorizz='',P_Capitolo='" + oModelPosFin.getProperty("/PosFin/Capitolo") + "',P_RecordType='OC')/Set"
				}

				var sTitle = "Quadro Contabile Capitolo " + object.Prctr + " " + object.Capitolo;
				this.getView().getModel("TitoloExport").setProperty("/Title",sTitle)

			} else if (sValue === "PF") {
				if (sPF.length !== 0) {
					var sEntity = "/QuadroContabile(P_Disp=true,P_AreaFin='S001',P_AnnoFase='" + sAnno + "',P_AnnoMin='" + sAnno + "',P_AnnoMax='" + (parseInt(sAnno) + 2) + "',P_Fase='NV',P_Eos='S',P_PosFin='" + sPF.replaceAll(".", "") + "',P_Autorizz='',P_Capitolo='" + sCP + "',P_RecordType='OP')/Set"
				} else {
					var sEntity = "/QuadroContabile(P_Disp=true,P_AreaFin='S001',P_AnnoFase='" + sAnno + "',P_AnnoMin='" + sAnno + "',P_AnnoMax='" + (parseInt(sAnno) + 2) + "',P_Fase='NV',P_Eos='S',P_PosFin='" + oModelPosFin.getProperty("/posFin").replaceAll(".", "") + "',P_Autorizz='',P_Capitolo='" + oModelPosFin.getProperty("/PosFin/Capitolo") + "',P_RecordType='OP')/Set"
				}

				var sTitle = "Quadro Contabile Posizione Finanziaria " + object.Prctr + " " +object.Capitolo+"."+object.Pg;
				this.getView().getModel("TitoloExport").setProperty("/Title",sTitle)
			} else {

				if (sCB.length !== 0) {
					var sEntity = "/QuadroContabile(P_Disp=true,P_AreaFin='S001',P_AnnoFase='" + sAnno + "',P_AnnoMin='" + sAnno + "',P_AnnoMax='" + (parseInt(sAnno) + 2) + "',P_Fase='NV',P_Eos='S',P_PosFin='" + sPF.replaceAll(".", "") + "',P_Autorizz='" + sCB + "',P_Capitolo='" + sCP + "',P_RecordType='CB')/Set"
				} else {
					var sEntity = "/QuadroContabile(P_Disp=true,P_AreaFin='S001',P_AnnoFase='" + sAnno + "',P_AnnoMin='" + sAnno + "',P_AnnoMax='" + (parseInt(sAnno) + 2) + "',P_Fase='NV',P_Eos='S',P_PosFin='" + oModelPosFin.getProperty("/posFin") + "',P_Autorizz='" + oAut.Auth.IdAutorizzazione + "',P_Capitolo='" + oModelPosFin.getProperty("/PosFin/Capitolo") + "',P_RecordType='CB')/Set"
				}
				
				var sTitle = "Quadro Contabile del Coding Block  " + object.Prctr + " " +object.Capitolo+"."+object.Pg + " " + this.getView().getModel("modelPosFin").getProperty("/AuthDesc");
				this.getView().getModel("TitoloExport").setProperty("/Title",sTitle)
			}
			
			if(sValue ==="PF" || sValue==="CAP"){
					this.getView().setModel(new JSONModel({FlagCassa:"X"}), "modelCheckCassa");
			}else{
					this.getView().setModel(new JSONModel({FlagCassa:""}), "modelCheckCassa");
			}

			//!lt creo il modello per le etichette del quadro
			const annoParse = parseInt(sAnno)
			const anni = {
				annoCp1: annoParse.toString(),
				annoCp2: (annoParse+1).toString(),
				annoCp3: (annoParse+2).toString(),
				annoCs1: annoParse.toString(),
				annoCs2: (annoParse+1).toString(),
				annoCs3: (annoParse+2).toString(),
			}
			this.getView().setModel(new JSONModel(anni), "labelQuadro");
			this.getView().setModel(new JSONModel([]), `modelTableQuadroDal`);
			this.getView().setModel(new JSONModel([]), `modelTableQuadroDalCs`);

			this.timeCreate = undefined;
			if (!this.oDialogQuadro) {
				this.oDialogQuadro = sap.ui.xmlfragment(
					"zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.QuadroContabile",
					this
				);
				this.getView().addDependent(this.oDialogQuadro);
				this.timeCreate = "yes"
			}
			this.oDialogQuadro.openBy(oEvent.getSource());
			
			if (this.timeCreate) {
		//		this.functionTemp("idTableyearQuadro", "idColumnListItemsYearQuadro", "modelTableQuadro", "ImportoCPAnno", "Competenza");
		//		this.functionTemp("idTableyearQuadro", "idColumnListItemsYearQuadro", "modelTableQuadro", "ImportoCSAnno", "Cassa");
			}

			this.oDialogQuadro.setBusy(true);
			var aRes = await this.__getDataPromise(sEntity, [], oModelQuadro);
			this.formatterImporti(aRes, true)
			this.splitTable(aRes, "COMP", "modelTableQuadro");
			let dalAlCs = true
			//! LT dal al quadro contabile capitolo
			if(sValue === 'CAP'){
                    
				const entityDalAl = `/ZCOBI_I_CAP_DAL_AL(P_AnnoFase='${sAnno}',P_Fase='NV',P_Capitolo='${sCP}',P_Eos='S',P_Ammin='${object.Ammin}')/Set`
				var aReqDalAl = await this.__getDataPromise(entityDalAl, [], oModelQuadro);
				this.formatterImporti(aReqDalAl, false, "Importo")

				let quadroDal = aReqDalAl.filter(el => el.RecordType === 'CP')
				let quadroDalcs = aReqDalAl.filter(el => el.RecordType === 'CS')

				this.getView().setModel(new JSONModel(quadroDal), `modelTableQuadroDal`);
				this.getView().setModel(new JSONModel(quadroDalcs), `modelTableQuadroDalCs`);
		}else if(sValue === 'PF'){

			//const fictr = await this.__getStrutturaAmminCentrale(object, true);

			//const sstr = oModelPosFin.getProperty("/infoSottoStrumento")
      //let sEntityCp = `/ZCOBI_I_SSTRPF_DAL_AL(P_AnnoFase='${sAnno}',P_Fase='NV',P_Sstr='${object.CodiceSottostrumento}',P_Str='${object.CodiceStrumento}',P_Str_ori='${object.CodiceStrumentoOri}',P_StruttAmm='${object.Fictr}',P_PosFin='${sPF.replaceAll(".", "")}')/Set?`
      //let sEntityCs = `/ZCOBI_I_SSTR_DAL_AL(P_AnnoFase='${sAnno}',P_Fase='NV',P_Sstr='${object.CodiceSottostrumento}',P_Str='${object.CodiceStrumento}',P_Str_ori='${object.CodiceStrumentoOri}',P_StruttAmm='${object.Fictr}',P_PosFin='${sPF.replaceAll(".", "")}',P_Autorizz='')/Set?`
			let sEntityCp = `/ZCOBI_I_PF_DAL_AL_DLB(P_AnnoFase='${sAnno}',P_AnnoStr='${sAnno}',P_AnnoSstr='${(parseInt(sAnno) + 2)}',P_PosFin='${sPF}',P_StruttAmm='${object.Fictr}')/Set?sap-client=100`
      let sEntityCs = `/ZCOBI_I_QC_DAL_AL_DLB(P_AnnoFase='${sAnno}',P_AnnoStr='${sAnno}',P_AnnoSstr='${(parseInt(sAnno) + 2)}',P_PosFin='${sPF}',P_Autorizz='',P_StruttAmm='${object.Fictr}')/Set?sap-client=100`
			if(sEntityCp){  
				var aReqDalAlCp = await this.__getDataPromise(sEntityCp, [], oModelQuadro);
				this.formatterImporti(aReqDalAlCp, false, "Importo")

				aReqDalAlCp.forEach(el => {
					el.RecordType = "CP"
				});

					this.getView().setModel(new JSONModel(aReqDalAlCp), `modelTableQuadroDal`);
			}
			if(sEntityCs){                    
					var aFilters = [];
          aFilters.push(new sap.ui.model.Filter("RecordType", sap.ui.model.FilterOperator.EQ, "CS"));
					var aReqDalAlCs = await this.__getDataPromise(sEntityCs, aFilters, oModelQuadro);
					this.formatterImporti(aReqDalAlCs, false, "Importo")
					this.getView().setModel(new JSONModel(aReqDalAlCs), `modelTableQuadroDalCs`);
			}
		}else if(sValue === 'FN'){
			dalAlCs = false
			//Coding Block
      let sEntityCp = `/ZCOBI_I_QC_DAL_AL_DLB(P_AnnoFase='${sAnno}',P_AnnoStr='${sAnno}',P_AnnoSstr='${sAnno}',P_PosFin='${sPF}',P_Autorizz='${object.IdAutorizzazione}',P_StruttAmm='${object.Fictr}')/Set?sap-client=100`
		
			if(sEntityCp){
				var aReqDalAlCp = await this.__getDataPromise(sEntityCp, [], oModelQuadro);
				this.formatterImporti(aReqDalAlCp, false, "Importo")
				aReqDalAlCp = aReqDalAlCp.filter(el => el.RecordType === "CP")
				this.getView().setModel(new JSONModel(aReqDalAlCp), `modelTableQuadroDal`);
			}
		}

			this.getView().setModel(new JSONModel({ Title: sTitle, From: sValue, DalAlCs : dalAlCs  }), "modelTitle");
			this.oDialogQuadro.setBusy(false);
			this.getView().setBusy(false);
		},

		liveChangeimportiPlur: function(oEvent, sCase, sModel, sProp) {
			var that = this;
			//var sModelFragmAna = that._oDialogPlur.getModel(sModel);
			var sModelFragmAna = that.getView().getModel(sModel);
			if (sCase === "1") {
				var sPath = oEvent.getSource().getBindingContext(sModel).getPath().split("NAV_PLUR/")[1];
				var sModelFragItems = sModelFragmAna.getData().NAV_PLUR[sPath];
				// var sValue = oEvent.getParameters().value;
				var regex = /[a-zA-Z]/;
				var sImporto = sModelFragItems[sProp];
				if (regex.test(sImporto)) {
					sap.m.MessageBox.error("Formato Importo Errato");
					//that._oDialogPlur.getModel(sModel).getData().NAV_PLUR[sPath][sProp] = "0,00";
					that.getView().getModel(sModel).getData().NAV_PLUR[sPath][sProp] = "0,00";
				} else {
					var sImportAfterFormatter = that.formatter.formatterOptionFloat(sImporto);
					//that._oDialogPlur.getModel(sModel).getData().NAV_PLUR[sPath][sProp] = sImportAfterFormatter;
					that.getView().getModel(sModel).getData().NAV_PLUR[sPath][sProp] = sImportAfterFormatter;
				}
			} else {
				var sModelFragItems = sModelFragmAna.getData();
				var regex = /[a-zA-Z]/;
				var sImporto = sModelFragItems[sProp];
				if (regex.test(sImporto)) {
					sap.m.MessageBox.error("Formato Importo Errato");
					that.getView().getModel(sModel).getData()[sProp] = "0,00";
				} else {
					var sImportAfterFormatter = that.formatter.formatterOptionFloat(sImporto);
					that.getView().getModel(sModel).getData()[sProp] = sImportAfterFormatter;
				}
			}
			that.getView().getModel(sModel).updateBindings(true);
		},

		/**
		 * Event handler 
		 * 
		 * @param {sap.ui.base.Event} oEvent - Event class
		 * @public
		 */
		onValueHelpPosFinList: function (oEvent) {
			if(!this.oDialogTablePosFin) {
				Fragment.load({
					name:"zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.TablePosizioneFinanziaria",
					controller: this
				}).then(oDialog => {
					this.oDialogTablePosFin = oDialog;
					this.getView().addDependent(oDialog);
					this.oDialogTablePosFin.open();
				})
			} else {
				this.oDialogTablePosFin.open();
			}
		},

		handleCloseFinan: function (oEvent) {
		},

		/**
		 * Event handler 
		 * 
		 * @param {sap.ui.base.Event} oEvent - Event class
		 * @public
		 */
		onPressResetForm: function (oEvent) {
			const modelPosFin = this.getOwnerComponent().getModel("modelPosFin")
			modelPosFin.setProperty("/posFinHelp/posFin/Fipex", "");
			
		},

		/**
		 * Event handler 
		 * 
		 * @param {sap.ui.base.Event} oEvent - Event class
		 * @public
		 */
		onPressAvvia: function (oEvent) {
			const modelPosFin = this.getOwnerComponent().getModel("modelPosFin")
			if (modelPosFin.getProperty("/posFinHelp/posFin/Fipex").length === 0) {
				this.setUrlSac();
				return;
			}
			var oPosFin = modelPosFin.setProperty("/PosFin");
			this.setUrlSac(oPosFin);
		},

		/**
		 * Event handler 
		 * 
		 * @param {sap.ui.base.Event} oEvent - Event class
		 * @public
		 */
		onPressNavToDetailPosFinFinanziamento: function (oEvent) {
			const modelPosFin = this.getView().getModel("modelPosFin")
			const oSottostrumento = modelPosFin.getProperty("/infoSottoStrumento")
			const oPosFin = modelPosFin.getProperty("/PosFin")
			modelPosFin.setProperty("/tablePosFin", [])
			var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
			if (oSottostrumento.TipoEsposizione === "7") {
				oRouter.navTo("Riprogrammazioni",{
					Fikrs: oSottostrumento.Fikrs,
					CodiceStrumento: oSottostrumento.CodiceStrumento,
					CodiceStrumentoOri: oSottostrumento.CodiceStrumentoOri,
					CodiceSottostrumento: oSottostrumento.CodiceSottostrumento,
					Datbis: oSottostrumento.Datbis.toISOString(),
					Auth: modelPosFin.getProperty("/Finanziamento/Amministrazione/Fincode")
				});
				return;
			} 
			oRouter.navTo("DetailPosFinFinanziamento",{
				Fikrs: oSottostrumento.Fikrs,
				CodiceStrumento: oSottostrumento.CodiceStrumento,
				CodiceStrumentoOri: oSottostrumento.CodiceStrumentoOri,
				CodiceSottostrumento: oSottostrumento.CodiceSottostrumento,
				Datbis: oSottostrumento.Datbis.toISOString(),
				Anno: oPosFin.Anno,
				Fase: oPosFin.Fase,
				Reale: oPosFin.Reale,
				Fipex: oPosFin.Fipex,
				Auth: modelPosFin.getProperty("/Finanziamento/Amministrazione/Fincode")
			});
		},

		onConfirmTablePosFin: async function (oEvent) {
			const modelPosFin = this.getOwnerComponent().getModel("modelPosFin")
			const oSelectedPosFin = modelPosFin.getProperty(oEvent.getParameter("selectedItem").getBindingContextPath())
			await this.__getStrutturaAmminCentrale(oSelectedPosFin);
			var oNewObject = Object.assign({}, oSelectedPosFin);
			modelPosFin.setProperty("/posFinHelp/posFin", oNewObject) 
			modelPosFin.setProperty("/posFin", oPosFin.CodificaRepPf)
			modelPosFin.setProperty("/PosFin", oNewObject);
			// modelPosFin.setProperty("/elencoPosFin", [])
			// this.oDialogTablePosFin.close()
		},
		

		onResetRicercaAuth: function (oEvent) {
			this.getView().getModel("modelPosFin").setProperty("/formAutorizzazione/Item", {});
		},
		onConfirmItem: function (oEvent, value) {
			//let {_, value} = oEvent.getSource().getCustomData()[0].mProperties;
			let modelPosFin = this.getView().getModel("modelPosFin");
			let sPath;
			var object;
			switch (value) {
				case "Tipo":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths();
					if(!sPath) break
					object = modelPosFin.getProperty(sPath[0]);
					modelPosFin.setProperty("/formAutorizzazione/Item/Tipo" , object.DESC_SIGLA);
					modelPosFin.setProperty("/formAutorizzazione/Item/TipoKey" , object.DESC_SIGLA);
					break
				case "Numero":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths();
					if(!sPath) break
					object = modelPosFin.getProperty(sPath[0]);
					modelPosFin.setProperty("/formAutorizzazione/Item/Tipo" , object.DESC_SIGLA)
					modelPosFin.setProperty("/formAutorizzazione/Item/Numero" , object.NUMERO_ATTO)
					break;
				case "Anno":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths();
					if(!sPath) break
					object = modelPosFin.getProperty(sPath[0]);
					modelPosFin.setProperty("/formAutorizzazione/Item/Tipo" , object.DESC_SIGLA)
					modelPosFin.setProperty("/formAutorizzazione/Item/Numero" , object.NUMERO_ATTO)
					modelPosFin.setProperty("/formAutorizzazione/Item/Anno" , object.ANNO_ATTO)
					break;
				case "Articolo":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths();
					if(!sPath) break
					object = modelPosFin.getProperty(sPath[0]);
					modelPosFin.setProperty("/formAutorizzazione/Item/Articolo", object.NUMERO_ARTICOLO)
					break;
				case "Subarticolo":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths();
					if(!sPath) break
					object = modelPosFin.getProperty(sPath[0]);
					modelPosFin.setProperty("/formAutorizzazione/Item/Subarticolo", object.DESCR_SUBARTICOLO)
					modelPosFin.setProperty("/formAutorizzazione/Item/SubarticoloKey", object.NUMERO_SUBARTICOLO)
					break;
				case "Comma":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths();
					if(!sPath) break
					object = modelPosFin.getProperty(sPath[0]);
					modelPosFin.setProperty("/formAutorizzazione/Item/Comma", object.COMMA)
					break;
				case "Subcomma":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths();
					if(!sPath) break
					object = modelPosFin.getProperty(sPath[0]);
					modelPosFin.setProperty("/formAutorizzazione/Item/Subcomma", object.DESCR_SUBCOMMA)
					modelPosFin.setProperty("/formAutorizzazione/Item/SubcommaKey", object.SUBCOMMA)
					break;
				case "Lettera":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths();
					if(!sPath) break
					object = modelPosFin.getProperty(sPath[0]);
					modelPosFin.setProperty("/formAutorizzazione/Item/Lettera", object.ZZPUNTO)
					break;
				case "Sublettera":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths();
					if(!sPath) break
					object = modelPosFin.getProperty(sPath[0]);
					modelPosFin.setProperty("/formAutorizzazione/Item/Sublettera", object.DESCR_SUBPUNTO)
					modelPosFin.setProperty("/formAutorizzazione/Item/SubletteraKey", object.ZZSUBPUNTO)
					break;
				case "NumeroSublettera":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths();
					if(!sPath) break
					object = modelPosFin.getProperty(sPath[0]);
					modelPosFin.setProperty("/formAutorizzazione/Item/NumeroSubLettera", object.DESCR_NUMERO_SUBLETTERA)
					modelPosFin.setProperty("/formAutorizzazione/Item/NumeroSubLetteraKey", object.NUMERO_SUBLETTERA)
					break;
				case "NumeroLettera":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths();
					if(!sPath) break
					object = modelPosFin.getProperty(sPath[0]);
					modelPosFin.setProperty("/formAutorizzazione/Item/NumeroLettera", object.NUMERO_LETTERA)
					break;
				case "Nickname":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths();
					if(!sPath) break
					object = modelPosFin.getProperty(sPath[0]);
					modelPosFin.setProperty("/formAutorizzazione/Item/Nickname", object.DESCR_ESTESA)
					modelPosFin.setProperty("/formAutorizzazione/Item/NicknameKey", object.NICKNAME)
					break;
				default:
					break;
			}
			oEvent.getSource().getParent().close()		
		},
		_setFiltersForm: function (aFilters, modelPosFin) {
			let itemFiltri = modelPosFin.getProperty("/formAutorizzazione/Item")
			if(itemFiltri.Tipo)
				aFilters.push(new Filter("Type", FilterOperator.EQ, itemFiltri.Tipo))
			if(itemFiltri.Numero)
				aFilters.push(new Filter("Numero", FilterOperator.EQ, itemFiltri.Numero))
			if(itemFiltri.Anno)
				aFilters.push(new Filter("Anno", FilterOperator.EQ, itemFiltri.Anno))
			if(itemFiltri.Articolo)
				aFilters.push(new Filter("Articolo", FilterOperator.EQ, itemFiltri.Articolo))
			if(itemFiltri.Subarticolo)
				aFilters.push(new Filter("Subarticolo", FilterOperator.EQ, itemFiltri.SubarticoloKey))
			if(itemFiltri.Comma)
				aFilters.push(new Filter("Comma", FilterOperator.EQ, itemFiltri.Comma))
			if(itemFiltri.Subcomma)
				aFilters.push(new Filter("Subcomma", FilterOperator.EQ, itemFiltri.SubcommaKey))
			if(itemFiltri.Lettera)
				aFilters.push(new Filter("Punto", FilterOperator.EQ, itemFiltri.Lettera))
			if(itemFiltri.Sublettera)
				aFilters.push(new Filter("Subpunto", FilterOperator.EQ, itemFiltri.SubletteraKey))
			if(itemFiltri.NumeroLettera)
				aFilters.push(new Filter("NumeroLettera", FilterOperator.EQ, itemFiltri.NumeroLettera))
			if(itemFiltri.NumeroSubLettera)
				aFilters.push(new Filter("NumeroSublettera", FilterOperator.EQ, itemFiltri.NumeroSubLetteraKey))
			if(itemFiltri.Classificazione)
				aFilters.push(new Filter("Classificazione", FilterOperator.EQ, itemFiltri.Classificazione))
			else 
				aFilters.push(new Filter("Classificazione", FilterOperator.NE, "E"))
			if(itemFiltri.Nickname)
				aFilters.push(new Filter("Nickname", FilterOperator.EQ, itemFiltri.NicknameKey))
			if(itemFiltri.Attivazione)
				aFilters.push(new Filter("AnnoAttivazione", FilterOperator.EQ, itemFiltri.Attivazione.getFullYear().toString()))
			if(itemFiltri.Scadenza)
				aFilters.push(new Filter("AnnoScadenza", FilterOperator.EQ, itemFiltri.Scadenza.getFullYear().toString()))
			if(itemFiltri.Monitoraggio)
				aFilters.push(new Filter("IndicatMonit", FilterOperator.EQ, itemFiltri.Monitoraggio === "Mon" ? "X" : ""))
			if(itemFiltri.DescCompatta)
				aFilters.push(new Filter("ZzdescrEstesaFm", FilterOperator.Contains, itemFiltri.DescCompatta))
			// if(itemFiltri.TipoAut)
			// 	aFilters.push(new Filter("Tipo", FilterOperator.EQ, itemFiltri.TipoAut))

			return aFilters
		},

		onOpenFormRicercaAuth: function (oEvent) {
			if(!this.oDialogFormRicercaAuth) {
				Fragment.load({
					name:"zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.FormRicercaAutorizzazione",
					controller: this
				}).then(oDialog => {
					this.oDialogFormRicercaAuth = oDialog;
					this.getView().addDependent(oDialog);
					this.oDialogFormRicercaAuth.open();
				})
			} else {
				this.oDialogFormRicercaAuth.open();
			}
		},

		openHVAutorizzazione: function (sNameFragment, sNameVariable) {
			if(!this[sNameVariable]) {
				Fragment.load({
					name:"zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.HVAutorizzazioni." + sNameFragment,
					controller: this
				}).then(oDialog => {
					this[sNameVariable] = oDialog;
					this.getView().addDependent(oDialog);
					this[sNameVariable].open();
				})
			} else {
				this[sNameVariable].open();
			}
		},

		onHVTipo: function (oEvent) {
			//lt recupero 
			var dati = oEvent.getSource().data();
			const formatDate = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "yyyyMMdd" })
			const modelAuth = this.getOwnerComponent().getModel("sapHanaS2Autorizzazioni")
			const modelPosFin = this.getView().getModel("modelPosFin")
			modelPosFin.setProperty(dati.PathResults, [])
			modelPosFin.setProperty("/busyAuth", true)
			var aFilters = this.aFiltersAutorizzazione(dati.Dialog, modelPosFin);
			if(dati.Entity !== '/ZES_LEGGI_SET')
				aFilters.push(new Filter("REALE", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")))
			if(dati.Entity === '/ZES_LEGGI_SET'){
				aFilters.push(new Filter("DATAB", FilterOperator.LE, formatDate.format(new Date())))
				// aFilters.push(new Filter("DATBIS", FilterOperator.GE, formatDate.format(new Date())))
			}

			if(dati.Fragment === "HVArticolo" ){ //&& modelPosFin.getProperty("/formAutorizzazione/Item/Numero")
				if(modelPosFin.getProperty("/formAutorizzazione/Item/Anno")){
					aFilters.push(new Filter("NUMERO_ATTO", FilterOperator.EQ, modelPosFin.getProperty("/formAutorizzazione/Item/Numero")))
					aFilters.push(new Filter("ANNO_ATTO", FilterOperator.EQ, modelPosFin.getProperty("/formAutorizzazione/Item/Anno")))
					aFilters.push(new Filter("DESC_SIGLA", FilterOperator.EQ, modelPosFin.getProperty("/formAutorizzazione/Item/Tipo")))
				} else if(modelPosFin.getProperty("/formAutorizzazione/Item/Numero")){
					aFilters.push(new Filter("NUMERO_ATTO", FilterOperator.EQ, modelPosFin.getProperty("/formAutorizzazione/Item/Numero")))
					aFilters.push(new Filter("DESC_SIGLA", FilterOperator.EQ, modelPosFin.getProperty("/formAutorizzazione/Item/Tipo")))
				} else if(modelPosFin.getProperty("/formAutorizzazione/Item/Tipo")) {
					aFilters.push(new Filter("DESC_SIGLA", FilterOperator.EQ, modelPosFin.getProperty("/formAutorizzazione/Item/Tipo")))
				}
			}
				
			this.openHVAutorizzazione(dati.Fragment, dati.Dialog)
			modelAuth.read(dati.Entity, {
				filters : aFilters,
				success: (oData) => {
					if(dati.Entity === "/ZES_LEGGI_SET" || dati.Entity === "/ZES_AUTORIZZAZIONI_SET") {
						oData.results =  oData.results.filter(t => t.FIKRS === "S001")
					}

					if(dati.Fragment === "HVNumero"){
						oData.results = oData.results.filter((thing, index, self) => index === self.findIndex((t) => (
																			t.NUMERO_ATTO === thing.NUMERO_ATTO && t.DESC_SIGLA === thing.DESC_SIGLA
																			)))
					}
					if(dati.Fragment === "HVLettera"){
						oData.results =  oData.results.filter((t => e => !t.has(e.ZZPUNTO) && t.add(e.ZZPUNTO))(new Set)).filter(t => t.ZZPUNTO !== "")
					}
					if(dati.Fragment === "HVArticolo"){
						oData.results =  oData.results.filter((t => e => !t.has(e.NUMERO_ARTICOLO) && t.add(e.NUMERO_ARTICOLO))(new Set)).filter(t => t.NUMERO_ARTICOLO !== "")
					}
					if(dati.Fragment === "HVSubarticolo") {
						oData.results =  oData.results.filter((t => e => !t.has(e.NUMERO_SUBARTICOLO) && t.add(e.NUMERO_SUBARTICOLO))(new Set)).filter(t => t.NUMERO_SUBARTICOLO !== "")
					}
					if(dati.Fragment === "HVSublettera") {
						oData.results =  oData.results.filter((t => e => !t.has(e.ZZSUBPUNTO) && t.add(e.ZZSUBPUNTO))(new Set)).filter(t => t.ZZSUBPUNTO !== "")
					}
					if(dati.Fragment === "HVNumeroSubLettera") {
						oData.results =  oData.results.filter((t => e => !t.has(e.NUMERO_SUBLETTERA) && t.add(e.NUMERO_SUBLETTERA))(new Set)).filter(t => t.NUMERO_SUBLETTERA !== "")
					}
					if(dati.Fragment === "HVSubcomma") {
						oData.results =  oData.results.filter((t => e => !t.has(e.SUBCOMMA) && t.add(e.SUBCOMMA))(new Set)).filter(t => t.SUBCOMMA !== "")
					}
					if(dati.Fragment === "HVComma") {
						oData.results =  oData.results.filter((t => e => !t.has(e.COMMA) && t.add(e.COMMA))(new Set)).filter(t => t.COMMA !== "")
					}
					if(dati.Fragment === "HVNumeroLettera"){
						oData.results =  oData.results.filter((t => e => !t.has(e.NUMERO_LETTERA) && t.add(e.NUMERO_LETTERA))(new Set)).filter(t => t.NUMERO_LETTERA !== "")
					}
					if(dati.Fragment === "HVTipo"){
						oData.results = oData.results.filter((item, index, self) => {
							let matchingIndex = self.findIndex(
							  (otherItem) => otherItem.DESC_SIGLA === item.DESC_SIGLA
							);
							return index === matchingIndex;
						  });
						oData.results = oData.results.filter(it => it.DESC_SIGLA !== "")
					}
					modelPosFin.setProperty(dati.PathResults, oData.results)
					modelPosFin.setProperty("/busyAuth", false)
				},
				error: (res) => {
					modelPosFin.setProperty("/busyAuth", false)
				}
			})
		},

		aFiltersAutorizzazione: function (dialog, modelPosFin) {
			let aFilters = []
			switch (dialog) {
				case "dialogNumero":
					//aFilters.push(new Filter("FIKRS", FilterOperator.EQ, "S001"))
					if(modelPosFin.getProperty("/formAutorizzazione/Item/Tipo"))
						aFilters.push(new Filter("DESC_SIGLA", FilterOperator.EQ, modelPosFin.getProperty("/formAutorizzazione/Item/Tipo")))
					break;
				case "dialogAnno":
					if(modelPosFin.getProperty("/formAutorizzazione/Item/Numero"))
						aFilters.push(new Filter("NUMERO_ATTO", FilterOperator.EQ, modelPosFin.getProperty("/formAutorizzazione/Item/Numero")))
					if(modelPosFin.getProperty("/formAutorizzazione/Item/Tipo"))
						aFilters.push(new Filter("DESC_SIGLA", FilterOperator.EQ, modelPosFin.getProperty("/formAutorizzazione/Item/Tipo")))
					break
				default:
					break;
			}
			return aFilters;
		},

		__getStrutturaAmminCentrale: function (oPosFin, fromQuadro) {
			let modelPosFin = this.getView().getModel("modelPosFin")
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			return new Promise( (resolve, reject) => {
				modelHana.read("/StrutturaAmministrativaCentraleSet", {
					filters: [	new Filter("Fikrs", FilterOperator.EQ, oPosFin.Fikrs),
								new Filter("Fase", FilterOperator.EQ, oPosFin.Fase),
								new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
								// new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
								new Filter("Reale", FilterOperator.EQ, "R"),
								new Filter("Eos", FilterOperator.EQ, oPosFin.Eos),
								new Filter("Datbis", FilterOperator.GE,  new Date()),
								new Filter("Prctr", FilterOperator.EQ, oPosFin.Prctr),
								new Filter("CodiceCdr", FilterOperator.EQ, oPosFin.Cdr),
								new Filter("CodiceRagioneria", FilterOperator.EQ, oPosFin.Ragioneria),
								new Filter("CodiceUfficio", FilterOperator.EQ, '0000'),
					],
					success: (oData) =>  {
						modelPosFin.setProperty("/strutturaAmminCentrale", oData.results[0])
						resolve()
					}
				})
			})
		},
		_getSingleAutorizzazione: function () {
			sap.ui.getCore().byId("idAuthCompVert").setBusy(true)
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			//let modelPosFin = this.getView().getModel("modelPosFin")
			const modelRimVerticali = this.getView().getModel("modelRimVerticali")
			let aFilters = [
				new Filter("Fikrs", FilterOperator.EQ, modelRimVerticali.getProperty("/formCedenteRicevente/PosFin/Fikrs")),
				new Filter("Anno", FilterOperator.EQ, modelRimVerticali.getProperty("/formCedenteRicevente/PosFin/Anno")),
				new Filter("Fase", FilterOperator.EQ,modelRimVerticali.getProperty("/formCedenteRicevente/PosFin/Fase")),
				new Filter("Reale", FilterOperator.EQ,modelRimVerticali.getProperty("/formCedenteRicevente/PosFin/Reale")),
				new Filter("Fipex", FilterOperator.EQ,modelRimVerticali.getProperty("/formCedenteRicevente/PosFin/Fipex")),
				new Filter("Classificazione", FilterOperator.EQ, "FL")
			]
			modelHana.read("/AutorizzazioniSet",{
				filters: aFilters,
				success: (oData) =>{
					if(oData.results.length === 1){
						modelRimVerticali.setProperty("/formCedenteRicevente/DescrizioneCompatta", oData.results[0].DescEstesa ? oData.results[0].DescEstesa : oData.results[0].DescrizioneCompatta)
						modelRimVerticali.setProperty("/formCedenteRicevente/Auth",oData.results[0])
						modelRimVerticali.setProperty("/formCedenteRicevente/DescrInputAuthAssociata", oData.results[0].ZzdescrEstesaFm ? oData.results[0].ZzdescrEstesaFm : 'NULL')
					}
					sap.ui.getCore().byId("idAuthCompVert").setBusy(false)
				},
				error: (res) => {
					sap.ui.getCore().byId("idAuthCompVert").setBusy(false)
				}
			})
		},
        onClose: function (oEvent) {
			oEvent.getSource().getParent().close()
		},
		onPosFin: function () {
			if(!this.oDialogPosFin) {
				Fragment.load({
					name:"zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.PosFinHelp",
					controller: this
				}).then(oDialog => {
					this.oDialogPosFin = oDialog;
					this.getView().addDependent(oDialog);
					this.oDialogPosFin.open();
				})
			} else {
				this.oDialogPosFin.open();
			}
		},
		onHVAdattaFiltri: function (oEvent) {
			let modelPosFin = this.getOwnerComponent().getModel("modelPosFin")
			this.__setBusyHelp(modelPosFin, true)
			let {key, value} = oEvent.getSource().getCustomData()[0].mProperties
			modelPosFin.setProperty("/action_filtri", key)
			this.__getDataForHV(value, key) //estrae i dati filtrati nel caso ci siano selezioni di attributi padre
			Fragment.load({
				name:"zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.HVPosFin." + value,
				controller: this
			}).then(oDialog => {
				this[value] = oDialog
				this.getView().addDependent(oDialog);
				this[value].open()
			})
		},
		onCloseHVPosFin: function (oEvent) {
			oEvent.getSource().getParent().close()
		},
		__getDataForHV: function (sHV, sProperty) {
			let modelPosFin = this.getOwnerComponent().getModel("modelPosFin")
			let modelRimVerticali = this.getView().getModel("modelRimVerticali")
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let aFilters = [new Filter("Fikrs", FilterOperator.EQ, "S001"),
							new Filter("Fase", FilterOperator.EQ, "NV"),
							new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
							new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
							new Filter("Datbis", FilterOperator.GE, new Date())
							]
			switch (sHV) {
				case "HVCapitolo":
					aFilters.push(new Filter("Eos", FilterOperator.EQ, "S"))
					if(modelPosFin.getProperty("/" + sProperty + "/Prctr")){
						aFilters.push(new Filter("Prctr", FilterOperator.EQ, modelPosFin.getProperty("/" + sProperty + "/Prctr")))
					} else {
						if(modelPosFin.getProperty("/infoSottoStrumento/DomAmministrazione/results").length > 0)
							aFilters.push(this.__getFiltersOR(modelPosFin.getProperty("/infoSottoStrumento/DomAmministrazione/results"), "Prctr"))
					}
					modelHana.read("/TipCapitoloSet", {
						filters: aFilters,
						success:  (oData) => {
							modelPosFin.setProperty("/formPosFin/capitoli", function() {
								let aCapitoli = []
								
								for(let i = 0; i < oData.results.length; i++){
										if(!aCapitoli.find(item => (item.Prctr === oData.results[i].Prctr && item.Capitolo === oData.results[i].Capitolo)))
											aCapitoli.push(oData.results[i])
								}
								return aCapitoli
							}())
							this.__setBusyHelp(modelPosFin, false)
						}
					})
					break;
				case "HVPgChoice":
					aFilters.push(new Filter("Eos", FilterOperator.EQ, "S"))
					//LT FIX RICERCA CON PG < 80 NON POSSIBILE
					aFilters.push(new Filter("Pg", FilterOperator.LE, "80"))
					if(modelPosFin.getProperty("/" + sProperty + "/Capitolo")){
						aFilters.push(new Filter("Capitolo", FilterOperator.EQ, modelPosFin.getProperty("/" + sProperty + "/Capitolo")))
					}
					if(modelPosFin.getProperty("/" + sProperty + "/Prctr")){
						aFilters.push(new Filter("Prctr", FilterOperator.EQ, modelPosFin.getProperty("/" + sProperty + "/Prctr")))
					} else {
						if(modelPosFin.getProperty("/infoSottoStrumento/DomAmministrazione/results").length > 0)
							aFilters.push(this.__getFiltersOR(modelPosFin.getProperty("/infoSottoStrumento/DomAmministrazione/results"), "Prctr"))
					}
					modelHana.read("/TipCapitoloSet", {
						filters: aFilters,
						success:  (oData) => {
							modelPosFin.setProperty("/formPosFin/pg", oData.results)
							this.__setBusyHelp(modelPosFin, false)
						}
					})
					break;
				case "HVCdr":
					if(modelPosFin.getProperty("/" + sProperty + "/Prctr")){
						aFilters.push(new Filter("Prctr", FilterOperator.EQ, modelPosFin.getProperty("/" + sProperty + "/Prctr")))
					} else {
						if(modelPosFin.getProperty("/infoSottoStrumento/DomAmministrazione/results").length > 0)
							aFilters.push(this.__getFiltersOR(modelPosFin.getProperty("/infoSottoStrumento/DomAmministrazione/results"), "Prctr"))
					}
					modelHana.read("/TipAmministrazioneSet",{
						filters: aFilters,
						urlParameters: {
							$expand: "TipCdr"
						},
						success: (oData) => {
							modelPosFin.setProperty("/formPosFin/cdr", function() {
								let aCdr = []
								if(oData.results.length === 1) {
									for(let i = 0; i <  oData.results.length; i++){
										aCdr.push(...oData.results[i].TipCdr.results)
									}
								} else {
									for(let i = 0; i < oData.results.length; i++){
										aCdr.push(...oData.results[i].TipCdr.results)
									}
								}
								return aCdr
							}())
							this.__setBusyHelp(modelPosFin, false)
						},
						error:  (err) => {
							this.__setBusyHelp(modelPosFin, false)
						}
					})
					break
				case "HVRagioneria":
					if(modelPosFin.getProperty("/" + sProperty + "/Prctr")){
						aFilters.push(new Filter("Prctr", FilterOperator.EQ, modelPosFin.getProperty("/" + sProperty + "/Prctr")))
					} else {
						if(modelPosFin.getProperty("/infoSottoStrumento/DomAmministrazione/results").length > 0)
							aFilters.push(this.__getFiltersOR(modelPosFin.getProperty("/infoSottoStrumento/DomAmministrazione/results"), "Prctr"))
					}
					modelHana.read("/RelazioneAmminRagioneriaSet", {
						filters: aFilters,
						success: (oData) => {
							modelPosFin.setProperty("/formPosFin/ragionerie", oData.results)
							this.__setBusyHelp(modelPosFin, false)
						}
					})
					break
				case "HVMissione":
					if(modelPosFin.getProperty("/infoSottoStrumento/DomMissione/results").length > 0) {
						aFilters.push(this.__setMultiFiltersMissione(modelPosFin.getProperty("/infoSottoStrumento/DomMissione/results"), ["Missione", "Programma", "Azione", "Prctr"]))
					}
					if(modelPosFin.getProperty("/infoSottoStrumento/DomAmministrazione/results").length > 0)
						aFilters.push(this.__getFiltersOR(modelPosFin.getProperty("/infoSottoStrumento/DomAmministrazione/results"), "Prctr"))
					modelHana.read("/TipMissioneSet",{
						filters: aFilters,
						success:  (oData) => {
							modelPosFin.setProperty("/formPosFin/missioni", function() {
								let aMissioni = []
									for(let i = 0; i <  oData.results.length; i++){
											if(!aMissioni.find(item => (item.Missione === oData.results[i].Missione)))
												aMissioni.push(oData.results[i])
									}
								return aMissioni
							}())
							this.__setBusyHelp(modelPosFin, false)
						}
					})
					break
				case "HVProgramma":
					if(modelPosFin.getProperty("/" + sProperty + "/Prctr")) {
						aFilters.push(new Filter("Prctr", FilterOperator.EQ, modelPosFin.getProperty("/" + sProperty + "/Prctr")))
					} else {
						if(modelPosFin.getProperty("/infoSottoStrumento/DomAmministrazione/results").length > 0) { //filtra per amministrazioni del dominio, se non è stata selezionata un'amministrazione
							aFilters.push(this.__getFiltersOR(modelPosFin.getProperty("/infoSottoStrumento/DomAmministrazione/results"), "Prctr"))
						}
					}
					if(modelPosFin.getProperty("/" + sProperty + "/Missione")) {
						aFilters.push(new Filter("Missione", FilterOperator.EQ, modelPosFin.getProperty("/" + sProperty + "/Missione")))
					} else {
						if(modelPosFin.getProperty("/infoSottoStrumento/DomMissione/results").length > 0) {
							aFilters.push(this.__setMultiFiltersMissione(modelPosFin.getProperty("/infoSottoStrumento/DomMissione/results"), ["Missione", "Programma", "Prctr"]))
						}
					}
					modelHana.read("/TipMissioneSet",{
						filters: aFilters,
						success:  (oData) => {
							modelPosFin.setProperty("/formPosFin/programmi", function() {
								let aProgrammi = []
									for(let i = 0; i <  oData.results.length; i++){
										if(aProgrammi.filter(item => (item.Missione === oData.results[i].Missione &&
											item.Programma === oData.results[i].Programma)).length === 0)
												aProgrammi.push(oData.results[i])
									}
								return aProgrammi
							}())
							this.__setBusyHelp(modelPosFin, false)
						}
					})
					break
				case "HVAzione":
					//se si apre help value di Programma, controllare che sia stato valorizzata Missione e filtrare per tale valore
					if(modelPosFin.getProperty("/" + sProperty + "/Prctr")) { // Filtro amministrazione se è stato già selezionato
						aFilters.push(new Filter("Prctr", FilterOperator.EQ, modelPosFin.getProperty("/" + sProperty + "/Prctr")))
					} else {
						if(modelPosFin.getProperty("/infoSottoStrumento/DomAmministrazione/results").length > 0) { //filtra per amministrazioni del dominio, se non è stata selezionata un'amministrazione
							aFilters.push(this.__getFiltersOR(modelPosFin.getProperty("/infoSottoStrumento/DomAmministrazione/results"), "Prctr"))
						}
					}
					if(modelPosFin.getProperty("/" + sProperty + "/Programma")) {
						aFilters.push(new Filter("Programma", FilterOperator.EQ, modelPosFin.getProperty("/" + sProperty + "/Programma")))
					} 
					if(modelPosFin.getProperty("/" + sProperty + "/Missione")) {
						aFilters.push(new Filter("Missione", FilterOperator.EQ, modelPosFin.getProperty("/" + sProperty + "/Missione")))
					} else {
						if(modelPosFin.getProperty("/infoSottoStrumento/DomMissione/results").length > 0) {
							aFilters.push(this.__setMultiFiltersMissione(modelPosFin.getProperty("/infoSottoStrumento/DomMissione/results"), ["Missione", "Programma", "Azione"]))
						}
					}
					modelHana.read("/TipMissioneSet",{
						filters: aFilters,
						success: (oData) => {
							modelPosFin.setProperty("/formPosFin/azioni", oData.results)	
							this.__setBusyHelp(modelPosFin, false)
						},
						error:  (err) => {this.__setBusyHelp(modelPosFin, false)}
					})
				break
				case "HVTitolo":
					aFilters.push(new Filter("Eos", FilterOperator.EQ, "S"))
					if(modelPosFin.getProperty("/infoSottoStrumento/DomTitolo/results").length > 0) {
						aFilters.push(this.__setMultiFiltersMissione(modelPosFin.getProperty("/infoSottoStrumento/DomTitolo/results"), ["Titolo", "Categoria", "Ce2", "Ce3"]))
					}
					modelHana.read("/TipTitoloSet",{
						filters: aFilters,
						success: (oData, res) => {
							oData.results = oData.results.filter( tit => !(tit.VersioneCategoria == "" || tit.VersioneCe2 == "" || tit.VersioneCe3 == "" || tit.VersioneTitolo == ""))
							modelPosFin.setProperty("/formPosFin/titoli", function() {
								let aTitoli = []
								for(let i = 0; i < oData.results.length; i++)
									if(!aTitoli.find(item => item.Titolo === oData.results[i].Titolo) )
										aTitoli.push(oData.results[i])
								
								return aTitoli
							}())
							this.__setBusyHelp(modelPosFin, false)
						}
					})
					break
				case "HVCategoria":
					aFilters.push(new Filter("Eos", FilterOperator.EQ, "S"))
					if(modelPosFin.getProperty("/" + sProperty + "/Titolo")) {
						aFilters.push(new Filter("Titolo", FilterOperator.EQ, modelPosFin.getProperty("/" + sProperty + "/Titolo")))
					} else {
						if(modelPosFin.getProperty("/infoSottoStrumento/DomTitolo/results").length > 0)
							aFilters.push(this.__setMultiFiltersMissione(modelPosFin.getProperty("/infoSottoStrumento/DomTitolo/results"), ["Titolo", "Categoria", "Ce2", "Ce3"]))
					}
					modelHana.read("/TipTitoloSet",{
						filters: aFilters,
						success: (oData) => {
							oData.results = oData.results.filter( tit => !(tit.VersioneCategoria == "" || tit.VersioneCe2 == "" || tit.VersioneCe3 == "" || tit.VersioneTitolo == ""))
							modelPosFin.setProperty("/formPosFin/categorie", function() {
								let aCategoria = []
								for(let i = 0; i < oData.results.length; i++)
									if(aCategoria.filter(item => item.Titolo === oData.results[i].Titolo &&
										item.Categoria === oData.results[i].Categoria).length === 0 )
										aCategoria.push(oData.results[i])
									
								return aCategoria
							}())
							this.__setBusyHelp(modelPosFin, false)
						}
					})
					break
				case "HVCe2" :
					aFilters.push(new Filter("Eos", FilterOperator.EQ, "S"))
					if(modelPosFin.getProperty("/" + sProperty + "/Titolo")) {
						aFilters.push(new Filter("Titolo", FilterOperator.EQ, modelPosFin.getProperty("/" + sProperty + "/Titolo")))
					} 
					if(modelPosFin.getProperty("/" + sProperty + "/Categoria")) {
						aFilters.push(new Filter("Categoria", FilterOperator.EQ, modelPosFin.getProperty("/" + sProperty + "/Categoria")))
					} 
					if(!(modelPosFin.getProperty("/" + sProperty + "/Categoria") && modelPosFin.getProperty("/" + sProperty + "/Titolo"))){
						if(modelPosFin.getProperty("/infoSottoStrumento/DomTitolo/results").length > 0)
							aFilters.push(this.__setMultiFiltersMissione(modelPosFin.getProperty("/infoSottoStrumento/DomTitolo/results"), ["Titolo", "Categoria", "Ce2", "Ce3"]))
					}
					modelHana.read("/TipTitoloSet",{
						filters: aFilters,
						success: (oData) => {
							oData.results = oData.results.filter( tit => !(tit.VersioneCategoria == "" || tit.VersioneCe2 == "" || tit.VersioneCe3 == "" || tit.VersioneTitolo == ""))
							modelPosFin.setProperty("/formPosFin/ce2", function() {
								let aCe2 = []
								for(let i = 0; i < oData.results.length; i++)
									
									if(aCe2.filter(item => item.Titolo === oData.results[i].Titolo &&
										item.Categoria === oData.results[i].Categoria &&
										item.Ce2 === oData.results[i].Ce2).length === 0 )
										aCe2.push(oData.results[i])
									
								return aCe2
							}())
							this.__setBusyHelp(modelPosFin, false)
						},
						error:  (err) => {
							this.__setBusyHelp(modelPosFin, false)
						}
					})
					break
				case "HVCe3":
					aFilters.push(new Filter("Eos", FilterOperator.EQ, "S"))
					if(modelPosFin.getProperty("/" + sProperty + "/Titolo")) {
						aFilters.push(new Filter("Titolo", FilterOperator.EQ, modelPosFin.getProperty("/" + sProperty + "/Titolo")))
					} 
					if(modelPosFin.getProperty("/" + sProperty + "/Categoria")) {
						aFilters.push(new Filter("Categoria", FilterOperator.EQ, modelPosFin.getProperty("/" + sProperty + "/Categoria")))
					} 
					if(modelPosFin.getProperty("/" + sProperty + "/Ce2")) {
						aFilters.push(new Filter("Ce2", FilterOperator.EQ, modelPosFin.getProperty("/" + sProperty + "/Ce2")))
					}
					if(!(modelPosFin.getProperty("/" + sProperty + "/Categoria") && modelPosFin.getProperty("/" + sProperty + "/Titolo") && modelPosFin.getProperty("/" + sProperty + "/Ce2"))){
						if(modelPosFin.getProperty("/infoSottoStrumento/DomTitolo/results").length > 0)
							aFilters.push(this.__setMultiFiltersMissione(modelPosFin.getProperty("/infoSottoStrumento/DomTitolo/results"), ["Titolo", "Categoria", "Ce2", "Ce3"]))
					}
					modelHana.read("/TipTitoloSet",{
						filters: aFilters,
						success: (oData) => {
							oData.results = oData.results.filter( tit => !(tit.VersioneCategoria == "" || tit.VersioneCe2 == "" || tit.VersioneCe3 == "" || tit.VersioneTitolo == ""))
							modelPosFin.setProperty("/formPosFin/ce3", oData.results)
							this.__setBusyHelp(modelPosFin, false)
						}
					})
					break
				default:
					break;
			}
		},
		onConfirmSelectionPosFin: function (oEvent, value) {
			//let {_, value} = oEvent.getSource().getCustomData()[0].mProperties
			let modelPosFin = this.getOwnerComponent().getModel("modelPosFin")
			let sAction = modelPosFin.getProperty("/action_filtri")
		
			let sPath, aAmministrazioni
			switch (value) {
				case "Amministrazione":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths()
					//check se sono stati selezionati figli; in caso di amministrazione non combaciante, resettare input
					if(modelPosFin.getProperty(sPath + "/Prctr") !== modelPosFin.getProperty("/" + sAction + "/Prctr")) {
						modelPosFin.setProperty("/" + sAction + "/CapitoloDesc", null)
						modelPosFin.setProperty("/" + sAction + "/Capitolo", null)
						modelPosFin.setProperty("/" + sAction + "/PgDesc", null)
						modelPosFin.setProperty("/" + sAction + "/Pg", null)
						modelPosFin.setProperty("/" + sAction + "/CdrDesc", null)
						modelPosFin.setProperty("/" + sAction + "/Cdr", null)
					}
					if(sAction === "adatta_filtri")
						modelPosFin.setProperty( "/" + sAction + "/AmministrazioneDesc", modelPosFin.getProperty(sPath + "/Prctr") + "-" +  modelPosFin.getProperty(sPath + "/DescEstesa"))
					else 
						modelPosFin.setProperty( "/" + sAction + "/AmministrazioneDesc", modelPosFin.getProperty(sPath + "/DescEstesa"))
					modelPosFin.setProperty( "/" + sAction + "/Prctr", modelPosFin.getProperty(sPath + "/Prctr"))

					break;
				case "Capitolo":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths()
					//check se sono stati selezionati figli; in caso di capitolo non combaciante, resettare input
					if(modelPosFin.getProperty(sPath[0] + "/Capitolo") !== modelPosFin.getProperty("/" + sAction + "/Capitolo")) {
						modelPosFin.setProperty("/" + sAction + "/PgDesc", null)
						modelPosFin.setProperty("/" + sAction + "/Pg", null)
					}
					aAmministrazioni = modelPosFin.getProperty("/formPosFin/amministrazioni")
					let oCapitolo = modelPosFin.getProperty(sPath[0])
					if(sAction === "adatta_filtri") {
						modelPosFin.setProperty("/" + sAction + "/CapitoloDesc", modelPosFin.getProperty(sPath[0] + "/Capitolo") + "-" + modelPosFin.getProperty(sPath[0] + "/DescEstesaCapitolo"))
						modelPosFin.setProperty("/" + sAction + "/AmministrazioneDesc", aAmministrazioni.filter(amm => amm.Prctr === oCapitolo.Prctr)[0].Prctr + "-" +  aAmministrazioni.filter(amm => amm.Prctr === oCapitolo.Prctr)[0].DescEstesa)
					} else {
						modelPosFin.setProperty("/" + sAction + "/CapitoloDesc",  modelPosFin.getProperty(sPath[0] + "/DescEstesaCapitolo"))
						modelPosFin.setProperty("/" + sAction + "/AmministrazioneDesc",  aAmministrazioni.filter(amm => amm.Prctr === oCapitolo.Prctr)[0].DescEstesa)
					}
					modelPosFin.setProperty("/" + sAction + "/Capitolo", modelPosFin.getProperty(sPath[0] + "/Capitolo"))
					modelPosFin.setProperty("/" + sAction + "/Prctr",aAmministrazioni.filter(amm => amm.Prctr === oCapitolo.Prctr)[0].Prctr)
					break
				case "Pg":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths()
					aAmministrazioni = modelPosFin.getProperty("/formPosFin/amministrazioni")
					let oPg = modelPosFin.getProperty(sPath[0])
					if(sAction === "adatta_filtri") {
						modelPosFin.setProperty("/" + sAction + "/PgDesc", modelPosFin.getProperty(sPath[0] + "/Pg") + "-" +  modelPosFin.getProperty(sPath[0] + "/DescEstesaPg"))
						modelPosFin.setProperty("/" + sAction + "/CapitoloDesc", modelPosFin.getProperty(sPath[0] + "/Capitolo") + "-" + modelPosFin.getProperty(sPath[0] + "/DescEstesaCapitolo"))
						modelPosFin.setProperty("/" + sAction + "/AmministrazioneDesc", aAmministrazioni.filter(amm => amm.Prctr === oPg.Prctr)[0].Prctr + "-" +  aAmministrazioni.filter(amm => amm.Prctr === oPg.Prctr)[0].DescEstesa)
					} else {
						modelPosFin.setProperty("/" + sAction + "/PgDesc",  modelPosFin.getProperty(sPath[0] + "/DescEstesaPg"))
						modelPosFin.setProperty("/" + sAction + "/CapitoloDesc", modelPosFin.getProperty(sPath[0] + "/DescEstesaCapitolo"))
						modelPosFin.setProperty("/" + sAction + "/AmministrazioneDesc", aAmministrazioni.filter(amm => amm.Prctr === oPg.Prctr)[0].DescEstesa)
					}
					modelPosFin.setProperty("/" + sAction + "/Pg", modelPosFin.getProperty(sPath[0] + "/Pg"))
					modelPosFin.setProperty("/" + sAction + "/Capitolo", modelPosFin.getProperty(sPath[0] + "/Capitolo"))
					modelPosFin.setProperty("/" + sAction + "/Prctr",aAmministrazioni.filter(amm => amm.Prctr === oPg.Prctr)[0].Prctr)
					break
				case "Cdr":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths()
					aAmministrazioni = modelPosFin.getProperty("/formPosFin/amministrazioni")
					let oCdr = modelPosFin.getProperty(sPath[0])
					if(sAction === "adatta_filtri") {
						modelPosFin.setProperty( "/" + sAction +  "/CdrDesc", modelPosFin.getProperty(sPath[0] + "/Cdr") + "-" + modelPosFin.getProperty(sPath[0] + "/DescEstesaCdr"))
						modelPosFin.setProperty("/" + sAction + "/AmministrazioneDesc", aAmministrazioni.filter(amm => amm.Prctr === oCdr.Prctr)[0].Prctr + "-" +  aAmministrazioni.filter(amm => amm.Prctr === oCdr.Prctr)[0].DescEstesa)
					} else {
						modelPosFin.setProperty( "/" + sAction +  "/CdrDesc", modelPosFin.getProperty(sPath[0] + "/DescEstesaCdr"))
						modelPosFin.setProperty("/" + sAction + "/AmministrazioneDesc", aAmministrazioni.filter(amm => amm.Prctr === oCdr.Prctr)[0].DescEstesa)
					}
					modelPosFin.setProperty("/" + sAction +  "/Cdr", modelPosFin.getProperty(sPath[0] + "/Cdr"))
					modelPosFin.setProperty("/" + sAction + "/Prctr",aAmministrazioni.filter(amm => amm.Prctr === oCdr.Prctr)[0].Prctr)
					break
				case "Ragioneria":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths()
					
					if(sAction === "adatta_filtri") {
						modelPosFin.setProperty("/" + sAction +  "/RagioneriaDesc",modelPosFin.getProperty(sPath[0]  + "/Ragioneria") + "-" + modelPosFin.getProperty(sPath[0]  + "/DescrEstesaRagioneria"))
						modelPosFin.setProperty("/" + sAction + "/AmministrazioneDesc", modelPosFin.getProperty(sPath[0]  + "/Prctr")  + "-" +  modelPosFin.getProperty(sPath[0]  + "/DescrEstesaAmmin"))
					} else {
						modelPosFin.setProperty("/" + sAction +  "/RagioneriaDesc", modelPosFin.getProperty(sPath[0]  + "/DescrEstesaRagioneria"))
						modelPosFin.setProperty("/" + sAction + "/AmministrazioneDesc", modelPosFin.getProperty(sPath[0]  + "/DescrEstesaAmmin"))
					}
					modelPosFin.setProperty("/" + sAction + "/Ragioneria", modelPosFin.getProperty(sPath[0]  + "/Ragioneria"))
					modelPosFin.setProperty("/" + sAction + "/Prctr", modelPosFin.getProperty(sPath[0]  + "/Prctr"))
					break;
				case "Missione":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths()
					//check se sono stati selezionati figli; in caso di Missione non combaciante, resettare input
					if(modelPosFin.getProperty(sPath + "/Missione") !== modelPosFin.getProperty("/" + sAction +  "/Missione")) {
						modelPosFin.setProperty("/" + sAction +  "/ProgrammaDesc", null)
						modelPosFin.setProperty("/" + sAction +  "/Programma",null)
						modelPosFin.setProperty("/" + sAction +  "/Azione", null)
						modelPosFin.setProperty("/" + sAction +  "/AzioneDesc",null)
					}
					if(sAction === "adatta_filtri") {
						modelPosFin.setProperty("/" + sAction +  "/MissioneDesc", modelPosFin.getProperty(sPath + "/Missione") + "-" + modelPosFin.getProperty(sPath + "/DescEstesaMissione"))
					} else { 
						modelPosFin.setProperty("/" + sAction +  "/MissioneDesc",  modelPosFin.getProperty(sPath + "/DescEstesaMissione"))
					}
					modelPosFin.setProperty("/" + sAction +  "/Missione", modelPosFin.getProperty(sPath + "/Missione"))

					break;
				case "Programma":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths()
					//check se sono stati selezionati figli; in caso di amministrazione non combaciante, resettare input
					if(modelPosFin.getProperty(sPath + "/Programma") !== modelPosFin.getProperty("/" + sAction + "/Programma")) {
						modelPosFin.setProperty("/" + sAction + "/AzioneDesc", null)
						modelPosFin.setProperty("/" + sAction + "/Azione",null)
					}
					if(sAction === "adatta_filtri") {
						modelPosFin.setProperty("/" + sAction +  "/MissioneDesc", modelPosFin.getProperty(sPath[0] + "/Missione") + "-" + modelPosFin.getProperty(sPath[0] + "/DescEstesaMissione"))
						modelPosFin.setProperty("/" + sAction +  "/ProgrammaDesc", modelPosFin.getProperty(sPath[0] + "/Programma") + "-" + modelPosFin.getProperty(sPath[0] + "/DescEstesaProgramma"))
					} else {
						modelPosFin.setProperty("/" + sAction +  "/MissioneDesc",  modelPosFin.getProperty(sPath[0] + "/DescEstesaMissione"))
						modelPosFin.setProperty("/" + sAction +  "/ProgrammaDesc", modelPosFin.getProperty(sPath[0] + "/DescEstesaProgramma"))
					}
					modelPosFin.setProperty("/" + sAction +  "/Missione", modelPosFin.getProperty(sPath[0] + "/Missione"))
					modelPosFin.setProperty("/" + sAction +  "/Programma", modelPosFin.getProperty(sPath[0] + "/Programma"))
					break;
				case "Azione":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths()
					if(sAction === "adatta_filtri") {
						modelPosFin.setProperty("/" + sAction + "/AmministrazioneDesc", modelPosFin.getProperty(sPath[0] + "/Prctr") + "-" +modelPosFin.getProperty(sPath[0] + "/DescEstesaPrctr"))
						modelPosFin.setProperty("/" + sAction +  "/MissioneDesc", modelPosFin.getProperty(sPath[0] + "/Missione") + "-" + modelPosFin.getProperty(sPath[0] + "/DescEstesaMissione"))
						modelPosFin.setProperty("/" + sAction +  "/ProgrammaDesc",  modelPosFin.getProperty(sPath[0] + "/Programma") + "-" + modelPosFin.getProperty(sPath[0] + "/DescEstesaProgramma"))
						modelPosFin.setProperty("/" + sAction + "/AzioneDesc",modelPosFin.getProperty(sPath[0] + "/Azione") + "-" + modelPosFin.getProperty(sPath[0] + "/DescEstesaAzione"))
					} else {
						modelPosFin.setProperty("/" + sAction + "/AmministrazioneDesc", modelPosFin.getProperty(sPath[0] + "/DescEstesaPrctr"))
						modelPosFin.setProperty("/" + sAction +  "/MissioneDesc",  modelPosFin.getProperty(sPath[0] + "/DescEstesaMissione"))
						modelPosFin.setProperty("/" + sAction +  "/ProgrammaDesc",  modelPosFin.getProperty(sPath[0] + "/DescEstesaProgramma"))
						modelPosFin.setProperty("/" + sAction + "/AzioneDesc", modelPosFin.getProperty(sPath[0] + "/DescEstesaAzione"))
					}
					modelPosFin.setProperty("/" + sAction + "/Prctr", modelPosFin.getProperty(sPath[0] + "/Prctr"))
					modelPosFin.setProperty("/" + sAction +  "/Missione", modelPosFin.getProperty(sPath[0] + "/Missione"))
					modelPosFin.setProperty("/" + sAction +  "/Programma", modelPosFin.getProperty(sPath[0] + "/Programma"))
					modelPosFin.setProperty("/" + sAction + "/Azione", modelPosFin.getProperty(sPath[0] + "/Azione"))
					
					break;
				case "Titolo":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths()
					//check se sono stati selezionati figli; in caso di Missione non combaciante, resettare input
					if(modelPosFin.getProperty(sPath + "/Titolo") !== modelPosFin.getProperty("/" + sAction + "/Titolo")) {
						modelPosFin.setProperty("/" + sAction + "/Categoria", null)
						modelPosFin.setProperty("/" + sAction + "/CategoriaDesc",null)
						modelPosFin.setProperty("/" + sAction + "/Ce2", null)
						modelPosFin.setProperty("/" + sAction + "/Ce2Desc",null)
						modelPosFin.setProperty("/" + sAction + "/Ce3", null)
						modelPosFin.setProperty("/" + sAction + "/Ce3Desc",null)
					}
					if(sAction === "adatta_filtri") {
						modelPosFin.setProperty("/" + sAction + "/TitoloDesc", modelPosFin.getProperty(sPath + "/Titolo") + "-" + modelPosFin.getProperty(sPath + "/DescEstesaTitolo"))
					} else {
						modelPosFin.setProperty("/" + sAction + "/TitoloDesc", modelPosFin.getProperty(sPath + "/DescEstesaTitolo"))
					}
					modelPosFin.setProperty("/" + sAction + "/Titolo", modelPosFin.getProperty(sPath + "/Titolo"))

					break;
				case "Categoria":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths()
					//check se sono stati selezionati figli; in caso di Missione non combaciante, resettare input
					if(modelPosFin.getProperty(sPath[0] + "/Categoria") !== modelPosFin.getProperty("/" + sAction + "/Categoria")) {
						modelPosFin.setProperty("/" + sAction + "/Ce2", null)
						modelPosFin.setProperty("/" + sAction + "/Ce2Desc", null)
						modelPosFin.setProperty("/" + sAction + "/Ce3", null)
						modelPosFin.setProperty("/" + sAction + "/Ce3Desc",null)
					}
					if(sAction === "adatta_filtri") {
						modelPosFin.setProperty("/" + sAction + "/TitoloDesc", modelPosFin.getProperty(sPath[0] + "/Titolo") + "-" +  modelPosFin.getProperty(sPath[0]  + "/DescEstesaTitolo"))
						modelPosFin.setProperty("/" + sAction + "/CategoriaDesc",modelPosFin.getProperty(sPath[0]  + "/Categoria") + "-" +  modelPosFin.getProperty(sPath[0] + "/DescEstesaCategoria"))
					} else {
						modelPosFin.setProperty("/" + sAction + "/TitoloDesc", modelPosFin.getProperty(sPath[0]  + "/DescEstesaTitolo"))
						modelPosFin.setProperty("/" + sAction + "/CategoriaDesc", modelPosFin.getProperty(sPath[0] + "/DescEstesaCategoria"))
					}
					modelPosFin.setProperty("/" + sAction + "/Titolo", modelPosFin.getProperty(sPath[0] + "/Titolo"))
					modelPosFin.setProperty("/" + sAction + "/Categoria", modelPosFin.getProperty(sPath[0]  + "/Categoria"))

					break;
				case "Ce2":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths()
					//check se sono stati selezionati figli; in caso di Missione non combaciante, resettare input
					if(modelPosFin.getProperty(sPath[0] + "/Ce2") !== modelPosFin.getProperty("/" + sAction +  "/Ce2")) {
						modelPosFin.setProperty("/" + sAction + "/Ce3", null)
						modelPosFin.setProperty("/" + sAction + "/Ce3Desc",null)
					}
					if(sAction === "adatta_filtri") {
						modelPosFin.setProperty("/" + sAction + "/TitoloDesc", modelPosFin.getProperty(sPath[0] + "/Titolo") + "-" +  modelPosFin.getProperty(sPath[0]  + "/DescEstesaTitolo"))
						modelPosFin.setProperty("/" + sAction + "/CategoriaDesc",modelPosFin.getProperty(sPath[0]  + "/Categoria") + "-" +  modelPosFin.getProperty(sPath[0] + "/DescEstesaCategoria"))
						modelPosFin.setProperty("/" + sAction +  "/Ce2Desc", modelPosFin.getProperty(sPath[0]  + "/Ce2") + "-" +   modelPosFin.getProperty(sPath[0] + "/DescEstesaCe2"))
					} else {
						modelPosFin.setProperty("/" + sAction + "/TitoloDesc",  modelPosFin.getProperty(sPath[0]  + "/DescEstesaTitolo"))
						modelPosFin.setProperty("/" + sAction + "/CategoriaDesc", modelPosFin.getProperty(sPath[0] + "/DescEstesaCategoria"))
						modelPosFin.setProperty("/" + sAction +  "/Ce2Desc",  modelPosFin.getProperty(sPath[0] + "/DescEstesaCe2"))
					}
					modelPosFin.setProperty("/" + sAction + "/Titolo", modelPosFin.getProperty(sPath[0] + "/Titolo"))
					modelPosFin.setProperty("/" + sAction + "/Categoria", modelPosFin.getProperty(sPath[0]  + "/Categoria"))
					modelPosFin.setProperty("/" + sAction +  "/Ce2", modelPosFin.getProperty(sPath[0]  + "/Ce2"))

					break;
				case "Ce3":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths()
					if(sAction === "adatta_filtri") {
						modelPosFin.setProperty("/" + sAction + "/TitoloDesc", modelPosFin.getProperty(sPath[0] + "/Titolo") + "-" +  modelPosFin.getProperty(sPath[0]  + "/DescEstesaTitolo"))
						modelPosFin.setProperty("/" + sAction + "/CategoriaDesc",modelPosFin.getProperty(sPath[0]  + "/Categoria") + "-" +  modelPosFin.getProperty(sPath[0] + "/DescEstesaCategoria"))
						modelPosFin.setProperty("/" + sAction +  "/Ce2Desc", modelPosFin.getProperty(sPath[0]  + "/Ce2") + "-" +   modelPosFin.getProperty(sPath[0] + "/DescEstesaCe2"))
						modelPosFin.setProperty("/" + sAction +  "/Ce3Desc", modelPosFin.getProperty(sPath[0]  + "/Ce3") + "-" + modelPosFin.getProperty(sPath[0] + "/DescEstesaCe3"))
					} else {
						modelPosFin.setProperty("/" + sAction + "/TitoloDesc", modelPosFin.getProperty(sPath[0]  + "/DescEstesaTitolo"))
						modelPosFin.setProperty("/" + sAction + "/CategoriaDesc",  modelPosFin.getProperty(sPath[0] + "/DescEstesaCategoria"))
						modelPosFin.setProperty("/" + sAction +  "/Ce2Desc", modelPosFin.getProperty(sPath[0] + "/DescEstesaCe2"))
						modelPosFin.setProperty("/" + sAction +  "/Ce3Desc",  modelPosFin.getProperty(sPath[0] + "/DescEstesaCe3"))
					}
					modelPosFin.setProperty("/" + sAction + "/Titolo", modelPosFin.getProperty(sPath[0] + "/Titolo"))
					modelPosFin.setProperty("/" + sAction + "/Categoria", modelPosFin.getProperty(sPath[0]  + "/Categoria"))
					modelPosFin.setProperty("/" + sAction +  "/Ce2", modelPosFin.getProperty(sPath[0]  + "/Ce2"))
					modelPosFin.setProperty("/" + sAction +  "/Ce3", modelPosFin.getProperty(sPath[0]  + "/Ce3"))

					break;
				default:
					break;
				}
				oEvent.getSource().getParent().close()
		},
		onResetPosFinHelp: function (oEvent) {
			const modelPosFin = this.getOwnerComponent().getModel("modelPosFin")
			modelPosFin.setProperty("/posFinHelp", {
				Prctr: !modelPosFin.getProperty("/ammCedente") ? modelPosFin.getProperty("/posFinHelp/Prctr") : null,
				AmministrazioneDesc: !modelPosFin.getProperty("/ammCedente") ? modelPosFin.getProperty("/posFinHelp/AmministrazioneDesc") : null
			})
			modelPosFin.setProperty("/elencoPosFin", [])
		},
		onAuth: async function  (oEvent) {
			const modelPosFin = this.getView().getModel("modelPosFin")
			const annoFormazione = this.getOwnerComponent().getModel("globalModel").getProperty("/ANNO")
			modelPosFin.setProperty("/dispAnnoFaseLabel", `Disponibilità ${parseInt(annoFormazione)}`)
			modelPosFin.setProperty("/dispAnnoPlusOneLabel", `Disponibilità ${parseInt(annoFormazione) + 1}`)
			modelPosFin.setProperty("/dispAnnoPlusTwoLabel",`Disponibilità ${parseInt(annoFormazione) + 2}`)
			modelPosFin.setProperty("/busyAuth", true)
			this.__getAuthorizzazioni()
			if(!this.oDialogAutorizzazioni) {
				Fragment.load({
					name:"zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.HVAutorizzazioni",
					controller: this
				}).then(oDialog => {
					this.oDialogAutorizzazioni = oDialog;
					this.getView().addDependent(oDialog);
					this.oDialogAutorizzazioni.open();
				})
			} else {
				this.oDialogAutorizzazioni.open();
			}
		},
		__getLabels: function () {
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getOwnerComponent().getModel("modelPosFin")

			return new Promise((resolve, reject) => {
				modelHana.read("/TriennioCalendarioFinSet",{
					filters: [
							new Filter("FaseCal", FilterOperator.EQ, "NV")
							],
					success: (oData) =>{
						modelPosFin.setProperty("/dispAnnoFaseLabel", oData.results[0].DispAnnoFase)
						modelPosFin.setProperty("/dispAnnoPlusOneLabel", oData.results[0].DispAnnoPlusOne)
						modelPosFin.setProperty("/dispAnnoPlusTwoLabel", oData.results[0].DispAnnoPlusTwo)
						resolve()
					},
					error: (res) => {
						resolve()
					}
				})
			})
		},
		onInsertCodingBlock: async function (oEvent) {
			const modelRimVerticali = this.getView().getModel("modelRimVerticali")
			const modelPosFin = this.getView().getModel("modelPosFin")
			const modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let oFormCodingBlock = modelRimVerticali.getProperty("/formCedenteRicevente")

			if(!oFormCodingBlock.PosFin){
				return MessageBox.error("Inserire una Posizione Finanziaria")
			}else{
				//lt controllo che la pos fin abbia 
				const pgFipex = oFormCodingBlock.PosFin.Fipex.substring(8,10)
				if(pgFipex && !Number.isNaN(pgFipex)){					
					if(parseInt(pgFipex) > 80) {
						MessageBox.error(`Non si può utilizzare una Posizione finanziaria con Piano di Gestione Maggiore di 80`)
						return;
					}
				}
			}
				

			if(!oFormCodingBlock.Auth){
				return MessageBox.error("Inserire un'Autorizzazione")
			}

			let strutturaAmm = await this._getEntitySet("/StrutturaAmministrativaCentraleSet",
														[
															new Filter("Fikrs", FilterOperator.EQ, oFormCodingBlock.PosFin.Fikrs),
															new Filter("Fase", FilterOperator.EQ, oFormCodingBlock.PosFin.Fase),
															new Filter("Anno", FilterOperator.EQ, oFormCodingBlock.PosFin.Anno),
															new Filter("Reale", FilterOperator.EQ, oFormCodingBlock.PosFin.Reale),
															new Filter("Eos", FilterOperator.EQ, oFormCodingBlock.PosFin.Eos),
															new Filter("Datbis", FilterOperator.GE,  new Date()),//oFormCodingBlock.PosFin.Datbis
															new Filter("Prctr", FilterOperator.EQ, oFormCodingBlock.PosFin.Prctr),
															new Filter("CodiceCdr", FilterOperator.EQ, oFormCodingBlock.PosFin.Cdr),
															new Filter("CodiceRagioneria", FilterOperator.EQ, oFormCodingBlock.PosFin.Ragioneria),
															new Filter("CodiceUfficio", FilterOperator.EQ, '0000')
														]
														,modelHana)

			if(oFormCodingBlock.Auth && oFormCodingBlock.PosFin && (oFormCodingBlock.Cedente || oFormCodingBlock.Ricevente)){
				let tablePosFinRicCed = modelRimVerticali.getProperty("/tablePosFinRicCed" )
				tablePosFinRicCed.push({
					...oFormCodingBlock.PosFin,
					...oFormCodingBlock.Auth,
					CedeRice: oFormCodingBlock.Cedente ? "CEDENTE" : "RICEVENTE",
					StrAmmResp: strutturaAmm["/StrutturaAmministrativaCentraleSet"]
				})
				if(oFormCodingBlock.Cedente){
					this.getView().setBusy(true)
					const infoSStr = modelPosFin.getProperty("/infoSottoStrumento")
					let oStrutturaAmmRes = await this._getEntitySet("/StrutturaAmministrativaCentraleSet",
														[
															new Filter("Fikrs", FilterOperator.EQ, oFormCodingBlock.PosFin.Fikrs),
															new Filter("Fase", FilterOperator.EQ, oFormCodingBlock.PosFin.Fase),
															new Filter("Anno", FilterOperator.EQ, oFormCodingBlock.PosFin.Anno),
															new Filter("Reale", FilterOperator.EQ, oFormCodingBlock.PosFin.Reale),
															new Filter("Eos", FilterOperator.EQ, oFormCodingBlock.PosFin.Eos),
															new Filter("Datbis", FilterOperator.GE, new Date() ), //oFormCodingBlock.PosFin.Datbis
															new Filter("Prctr", FilterOperator.EQ, oFormCodingBlock.PosFin.Prctr),
															new Filter("CodiceCdr", FilterOperator.EQ, oFormCodingBlock.PosFin.Cdr),
															new Filter("CodiceRagioneria", FilterOperator.EQ, oFormCodingBlock.PosFin.Ragioneria),
															new Filter("CodiceUfficio", FilterOperator.EQ, '0000')
														]
														,modelHana)
					//lt salvo la struttura amm centrale per ilpopup nella tabella
					
					//modelPosFin.setProperty("/strutturaAmminCentrale", oStrutturaAmmRes["/StrutturaAmministrativaCentraleSet"])
					//var strutturaAmministrativa = oStrutturaAmmRes["/StrutturaAmministrativaCentraleSet"]
					this.__getRiceventiPosFinCB(oFormCodingBlock, infoSStr, oStrutturaAmmRes, modelRimVerticali, modelHana)
						.then(res =>{
							let tablePosFinRicCed = modelRimVerticali.getProperty("/tablePosFinRicCed")
							for(let i = 0; i < res.length; i++) {
								tablePosFinRicCed.push({
									...res[i].PosFin,
									...res[i].CodingBlock,
									CedeRice: "RICEVENTE"
								})
							}
							modelRimVerticali.setProperty("/tablePosFinRicCed", tablePosFinRicCed)
							this.getView().setBusy(false)
						}).catch(err => {
							MessageBox.error("Errore nel recupero delle riceventi")
							this.getView().setBusy(false)
						})
				}
				modelRimVerticali.setProperty("/tablePosFinRicCed", tablePosFinRicCed)
			}
			this.oDialogCedRice.close()
		},

		onExpandPopOverDettStruttCentr: function (oEvent) {
                var oLink = oEvent.getSource(),
                oView = this.getView();
                //oView.setBusy(true)
                const modelPosFin = this.getView().getModel("modelPosFin");
                const modelHana = this.getOwnerComponent().getModel("sapHanaS2");
				var object = oEvent.getSource().getBindingContext("modelRimVerticali").getObject()

				this.getView().setModel(new JSONModel(object), "strutturaModel");


                          
                    // create popover
                    if (!this._pPopoverStruttAmmCentrVert) {
                        this._pPopoverStruttAmmCentrVert = Fragment.load({
                            id: oView.getId(),
                            name: "zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.HVPosFin.PopOverStruttAmmCentraleVert",
                            controller: this
                        }).then(function(oPopover) {
                            oView.addDependent(oPopover);
                            //oPopover.setBusy(true)
                            return oPopover;
                        });
                    }

                    this._pPopoverStruttAmmCentrVert.then(function(oPopover) {
                        oPopover.openBy(oLink);
                        //oPopover.setBusy(true)
                    });
                
            },
		
		onExpandPopOverPosFin: async function (oEvent) {
			var oButton = oEvent.getSource(),
			oView = this.getView();

			// create popover
			if (!this._pPopover) {
				this._pPopover = Fragment.load({
					id: oView.getId(),
					name: "zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.PopOverPosizioneFinanziaria",
					controller: this
				}).then(function(oPopover) {
					oView.addDependent(oPopover);
					return oPopover;
				});
			}
			this._pPopover.then(function(oPopover) {
				//oPopover.setBusy(true)
				oPopover.openBy(oButton);
			});
		},
		onExpandPopOverSottostrumento: function (oEvent) {
			var oButton = oEvent.getSource(),
			oView = this.getView();

			// create popover
			if (!this._pPopoverSottoStr) {
				this._pPopoverSottoStr = Fragment.load({
					id: oView.getId(),
					name: "zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.PopOverSottostrumento",
					controller: this
				}).then(function(oPopover) {
					oView.addDependent(oPopover);
					return oPopover;
				});
			}
			this._pPopoverSottoStr.then(function(oPopover) {
				oPopover.openBy(oButton);
			});
		},

		onNavToHome: async function () {		
            await this.unLockPosFin();	
			var oHistory = History.getInstance();
			var oRouter = this.getOwnerComponent().getRouter();
			oRouter.navTo("Home");	
		},
		/**
		 * Event handler 
		 * 
		 * @param {sap.ui.base.Event} oEvent - Event class
		 * @public
		 */
		onReimpostaAuth: function (oEvent) {
			const modelPosFin = this.getView().getModel("modelPosFin")
			const oSottostrumento = modelPosFin.getProperty("/infoSottoStrumento")
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
			oRouter.navTo("Finanziamento",{
				Fikrs: oSottostrumento.Fikrs,
				CodiceStrumento: oSottostrumento.CodiceStrumento,
				CodiceStrumentoOri: oSottostrumento.CodiceStrumentoOri,
				CodiceSottostrumento: oSottostrumento.CodiceSottostrumento,
				Datbis: oSottostrumento.Datbis.toISOString()
			});
		},
    });
});