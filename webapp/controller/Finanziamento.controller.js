sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/core/Fragment",
	"sap/m/MessageBox",
	"sap/ui/core/routing/History",
	"./BaseController",
	"sap/ui/core/BusyIndicator"
], function(Controller, JSONModel, Filter, FilterOperator, Fragment, MessageBox, History, BaseController, BusyIndicator) {
	"use strict";
	return BaseController.extend("zsap.com.r3.cobi.s4.gestposfinnv.controller.Finanziamento", {
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
			oRouter.getRoute("Finanziamento").attachPatternMatched(this._onObjectMatched, this);
        },
        _onObjectMatched: async function (oEvent) {
			this.getView().setBusy(true)
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

			const oKeySStr = oEvent.getParameter("arguments")
			let sAnnoFase = await this.__getAnnoFase()
			await this.__getAnnoFaseProcessoMacroFase()
			this.__getSottoStrumento(oKeySStr, sAnnoFase)

		},
        __getSottoStrumento(oKeySStr, sAnnoFase){
			const oModel = this.getOwnerComponent().getModel("sapHanaS2")
		
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
					this.getView().setBusy(false)					
				},
				error: (res) => {
					this.getView().setBusy(false)
				}
			})
		},

		onPressRicercaAuth: async function (oEvent) {
			const modelPosFin = this.getView().getModel("modelPosFin");
			const sEsposizione = modelPosFin.getProperty("/infoSottoStrumento/TipoEsposizione"); 
			const sAnno = modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr"); 
			const sFase = modelPosFin.getProperty("/infoSottoStrumento/Fase"); 
			const modelHana = this.getOwnerComponent().getModel("sapHanaS2Revisione")
			const modelHanaS2 = this.getOwnerComponent().getModel("sapHanaS2")
			modelPosFin.setProperty("/formAutorizzazione/resultsAuth", [])
			modelPosFin.setProperty("/busyAuth", true)
			let aFilters= [
				new Filter("Fikrs", FilterOperator.EQ, "S001"),
				new Filter("ZSLUG", FilterOperator.EQ, sEsposizione)
			]
			aFilters = this._setFiltersForm(aFilters, modelPosFin)
			var aPromise = [];
			this.openHVAutorizzazione("TableRicercaAuth", "TableRicercaAuth")
			// FaseAmministrazioni, Anno, Fase, Prctr, 1 è aperto
			aPromise.push(new Promise((success, error) => {
				modelHana.read("/NuovaAutorizzazioneSet", {
					urlParameters: {
						$expand: "AmminCompetenza"
					},
					filters: aFilters,
					success: (oData) => {
						if(modelPosFin.getProperty("/formAutorizzazione/Item/TipoAut"))
							oData.results = oData.results.filter(auth => auth.Tipo === modelPosFin.getProperty("/formAutorizzazione/Item/TipoAut"))
						// modelPosFin.setProperty("/formAutorizzazione/resultsAuth", oData.results)
						success(oData.results)
						modelPosFin.setProperty("/busyAuth", false)
					},
					error: (res) => {
						MessageBox.error("Errore nel recupero delle Autorizzazioni")
						modelPosFin.setProperty("/busyAuth", false)
						error(res);
					}
				})
			}));
			aFilters = [
				new Filter({
					filters: [
					new Filter("Anno", FilterOperator.EQ, sAnno),
					new Filter("Fase", FilterOperator.EQ, sFase),
					new Filter("FlagRevIgb01", FilterOperator.EQ, "1")
				],
					and: true
				}),
				
			]
			aPromise.push(new Promise ((success, error) => {
				modelHanaS2.read("/FasiAmministrazioniSet", {
					filters: aFilters,
					success: (oData) => {
						success(oData.results)
					},
					error: (res) => {
						error(res);
					}
				})
			}));
			var iIndex = 0;
			Promise.allSettled(aPromise).then((aResponse) => {
				if (aResponse[0].status === "rejected" || aResponse[1].status === "rejected") {
					MessageBox.error("Errore nel recupero delle Autorizzazioni");
					return Promise.resolve()
				}
				/* var aListAdministration = aResponse[1].value.filter((oAdministration) => {
					return oAdministration.FlagRevIgb01 == "1";
				}).map((oAdministration) =>{
					return oAdministration.Prctr;
				});

				let autFiltrateTest = jQuery.grep(aResponse[0].value, function(record, pos) {
					iIndex = record.AmminCompetenza.results.findIndex((oAmminCompetenza) => {
						return aListAdministration.includes(oAmminCompetenza.Prctr)
					})
					return (record.AllPrctr === true && aListAdministration.length > 0 )  || iIndex !== -1
				});       */
				modelPosFin.setProperty("/formAutorizzazione/resultsAuth", aResponse[0].value);
				return Promise.resolve()
			}).finally(() => {
				modelPosFin.setProperty("/busyAuth", false)
			})

		},

		onConfirmChoiceAuth: async function (oEvent) {
			const modelPosFin = this.getView().getModel("modelPosFin");
			const sEsposizione = modelPosFin.getProperty("/infoSottoStrumento/TipoEsposizione");
			let oSelectedItem = modelPosFin.getProperty(oEvent.getParameter("selectedItem").getBindingContextPath())
			const modelHana = this.getOwnerComponent().getModel("sapHanaS2Revisione")
			const modelHanaS2 = this.getOwnerComponent().getModel("sapHanaS2")
			var aFilters = [
				new Filter("Fincode", FilterOperator.EQ, oSelectedItem.Fincode),
				new Filter("Fikrs", FilterOperator.EQ, oSelectedItem.Fikrs),
				new Filter("Fase", FilterOperator.EQ, "NV"),
				new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
				new Filter("Attivo", FilterOperator.EQ, "X"),
				new Filter("Loekz", FilterOperator.EQ, ""),
				new Filter("Reale", FilterOperator.EQ, "R"),
				new Filter("ZSLUG", FilterOperator.EQ, sEsposizione)
			];
			BusyIndicator.show();
			modelPosFin.setProperty("/Finanziamento/Amministrazione", oSelectedItem)
			modelPosFin.setProperty("/Finanziamento/Amministrazione/DescrizioneAmministrazione", oSelectedItem.Beschr)
			modelPosFin.setProperty("/Finanziamento/Amministrazione/DescrizioneAmministrazioneLunga", oSelectedItem.ZzdescrEstesaFm ? oSelectedItem.ZzdescrEstesaFm : "NULL")
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
				if (sEsposizione === "7"){
					return Promise.resolve([]);
				}
				aData.forEach(oCodingBlock => {
					aFilters.push(new Filter("Fipex", FilterOperator.EQ, oCodingBlock.Fipex))
				});
				//! lt 20230904 -> inserito controllo su esistenza di amministrazioni 
				//! altrimenti il codice inserisce un  'false' che manda in timeout l'oData
				if(oSelectedItem.AmminCompetenza.results.length > 0){
					aFilters.push(new Filter({
						filters: oSelectedItem.AmminCompetenza.results.map((oAdministration) => {
							return new Filter("Prctr", FilterOperator.EQ,oAdministration.Prctr)
						}),
						and: false
					}))
				}
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
					if (aData.length === 1) {
						await this.__getStrutturaAmminCentrale(aData[0]);
						modelPosFin.setProperty("/posFinHelp/posFin", aData[0]);
						modelPosFin.setProperty("/posFin", aData[0].CodificaRepPf); //modelPosFin.setProperty("/posFin", oPosFin.CodificaRepPf)
						modelPosFin.setProperty("/PosFin", aData[0]);
					} else {
						modelPosFin.setProperty("/posFinHelp/posFin", {});
					}
			}).finally(() => {
				BusyIndicator.hide();
				this.oDialogFormRicercaAuth.close()
			})
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
			modelPosFin.setProperty("/strutturaAmminCentrale/Fictr","");
			modelPosFin.setProperty("/Finanziamento/Amministrazione/",{});
			modelPosFin.setProperty("/Finanziamento/Amministrazione/DescrizioneAmministrazioneLunga", "");
			modelPosFin.setProperty("/posFinHelp/posFin/Fipex", "");
			modelPosFin.setProperty("/posFin", "");
			modelPosFin.setProperty("/PosFin", {});
		},

		/**
		 * Event handler 
		 * 
		 * @param {sap.ui.base.Event} oEvent - Event class
		 * @public
		 */
		onPressNavToDetailPosFinFinanziamento: async function (oEvent) {
			const modelPosFin = this.getView().getModel("modelPosFin")
			const oSottostrumento = modelPosFin.getProperty("/infoSottoStrumento")
			const oPosFin = modelPosFin.getProperty("/PosFin")
			const oAuth = modelPosFin.getProperty("/Finanziamento/Amministrazione");
			
			modelPosFin.setProperty("/tablePosFin", [])
			var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
			if (oSottostrumento.TipoEsposizione === "7") {
				if(!await this.checkControlli(oSottostrumento)){
					return;
				}

				oRouter.navTo("Riprogrammazioni",{
					Fikrs: oSottostrumento.Fikrs,
					CodiceStrumento: oSottostrumento.CodiceStrumento,
					CodiceStrumentoOri: oSottostrumento.CodiceStrumentoOri,
					CodiceSottostrumento: oSottostrumento.CodiceSottostrumento,
					Datbis: oSottostrumento.Datbis.toISOString(),
					Fincode: modelPosFin.getProperty("/Finanziamento/Amministrazione/Fincode"),
					Fikrs: modelPosFin.getProperty("/Finanziamento/Amministrazione/Fikrs")
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
				Fincode: oAuth.Fincode,
				Fikrs: oAuth.Fikrs,
				Reale: oPosFin.Reale,
				Fipex: oPosFin.Fipex,
				Auth: modelPosFin.getProperty("/Finanziamento/Amministrazione/Fincode"),
				Esposizione : oSottostrumento.TipoEsposizione
			});
		},

		checkControlli: async function (oKeySStr) {
			
			const oModelVarCont = this.getOwnerComponent().getModel("modemVarCont")
			const modelPosFin = this.getView().getModel("modelPosFin")
			//this.getView().setModel(new JSONModel({visible : true, AllineaCassa : false}),"modelRip")
						
			var controllo = {
				"Fincode" : modelPosFin.getProperty("/Finanziamento/Amministrazione/Fincode"),
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
						}else{
							MessageBox.error("Errore di comunicazione")
							this.getView().setBusy(false)
						}
					}else{
						MessageBox.error("Errore di comunicazione")						
					} 
					return false
				}else{
					this.getView().setBusy(false)
					return true
				}
				
				//this.getView().getModel("modelRip").setProperty("/visible" , controlloAutorizzazione)
				
		},

		onConfirmTablePosFin: async function (oEvent) {
			const modelPosFin = this.getOwnerComponent().getModel("modelPosFin")
			const oSelectedPosFin = modelPosFin.getProperty(oEvent.getParameter("selectedItem").getBindingContextPath())
			await this.__getStrutturaAmminCentrale(oSelectedPosFin);
			modelPosFin.setProperty("/posFinHelp/posFin", oSelectedPosFin)
			modelPosFin.setProperty("/posFin", oSelectedPosFin.CodificaRepPf)
			modelPosFin.setProperty("/PosFin", oSelectedPosFin);
			// modelPosFin.setProperty("/elencoPosFin", [])
			// this.oDialogTablePosFin.close()a
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

		__getStrutturaAmminCentrale: function (oPosFin) {
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
        onSetAnnoRimVert: function (oEvent) {
            let modelRimVerticali = this.getView().getModel("modelRimVerticali")
            const oSource = oEvent.getSource();
			let val = oSource.getValue();

            modelRimVerticali.setProperty("/visibleRiceCede", val.length === 4 ? true : false)
            modelRimVerticali.setProperty("/tablePosFinRicCed", [])
			var globalModel = this.getOwnerComponent().getModel("globalModel")
			var globalData = this.getOwnerComponent().getModel("globalModel").getData()
			if(parseInt(globalData.ANNO) > parseInt(val) && val.length === 4){
				
				modelRimVerticali.setProperty("/visibleRiceCede", false)
				MessageBox.warning(`Inserire un anno maggiore o uguale all'anno di formazione: ${globalData.ANNO}`)
			}


            
        },
        onPressScegliCedRic: function (oEvent) {
			 //check se stato già selezionato un cedente
			 const modelRimVerticali = this.getView().getModel("modelRimVerticali")
			 const modelPosFin = this.getOwnerComponent().getModel("modelPosFin")

			 
		 
			 
			 modelRimVerticali.setProperty("/formCedenteRicevente", {})
			 modelPosFin.setProperty("/posFinHelp", {})
			 
			 const tablePosFinRicCed = modelRimVerticali.getProperty("/tablePosFinRicCed")
			 let oCedente = tablePosFinRicCed.find(cb => cb.CedeRice === "CEDENTE")
			 if(oCedente){
				modelRimVerticali.setProperty("/formCedenteRicevente/CedeRiceEdit", false)
				modelRimVerticali.setProperty("/formCedenteRicevente/Ricevente", true)
				modelRimVerticali.setProperty("/formCedenteRicevente/Cedente", false)
				modelPosFin.setProperty("/posFinHelp/Prctr", oCedente.Prctr)
				modelPosFin.setProperty("/posFinHelp/AmministrazioneDesc", oCedente.DescAmmin)
				modelPosFin.setProperty("/ammCedente", false)
			 } else {
				modelRimVerticali.setProperty("/formCedenteRicevente/CedeRiceEdit", true)
				modelRimVerticali.setProperty("/formCedenteRicevente/Ricevente", false)
				modelRimVerticali.setProperty("/formCedenteRicevente/Cedente", true)
				modelPosFin.setProperty("/posFinHelp/Prctr", null)
				modelPosFin.setProperty("/posFinHelp/AmministrazioneDesc", null)
				modelPosFin.setProperty("/ammCedente", true)
			 }
			 //fine check
            if(!this.oDialogCedRice)
                Fragment.load({
                    name:"zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.HVRimVerticali.HVRimVerticaliCB",
                    controller: this
                }).then(oDialog => {
                    this.oDialogCedRice = oDialog
                    this.getView().addDependent(oDialog);
                    this.oDialogCedRice.open()
                })
            else 
                this.oDialogCedRice.open()
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
		onPressConfPosFin: function (oEvent) {
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getOwnerComponent().getModel("modelPosFin")
			modelPosFin.setProperty("/tablePosFinBusy", true)
			let oFormPosf = modelPosFin.getProperty("/posFinHelp/")

			if(oFormPosf && oFormPosf.fipex && oFormPosf.fipex.length > 22){

				const pgFipex = oFormPosf.fipex.substring(8,10)
				if(pgFipex && !Number.isNaN(pgFipex)){					
					if(parseInt(pgFipex) > 80) {
						MessageBox.warning(`Non si può utilizzare una Posizione finanziaria con Piano di Gestione Maggiore di 80`)
						return;
					}
				}
			}

			
			let aFilters = this.__setFiltersHVPosFin(oFormPosf, true)			
			aFilters = this.__setDomSStrFilters(aFilters)
			
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
			modelHana.read("/PosizioneFinanziariaSet",{
				filters: aFilters,
				success: (oData, res) => {
					modelPosFin.setProperty("/elencoPosFin", oData.results)
					modelPosFin.setProperty("/tablePosFinBusy", false)
				},
				error: (err) => {
					modelPosFin.setProperty("/tablePosFinBusy", false)
					modelPosFin.setProperty("/elencoPosFin", [])
				}
			})
			
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
		__getAuthorizzazioni: function () {
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getOwnerComponent().getModel("modelPosFin")
			const modelRimVerticali = this.getView().getModel("modelRimVerticali")
			let aFilters = [
				new Filter("Fikrs", FilterOperator.EQ, modelRimVerticali.getProperty("/formCedenteRicevente/PosFin/Fikrs")),
				new Filter("Anno", FilterOperator.EQ, modelRimVerticali.getProperty("/formCedenteRicevente/PosFin/Anno")),
				new Filter("Fase", FilterOperator.EQ, modelRimVerticali.getProperty("/formCedenteRicevente/PosFin/Fase")),
				new Filter("Reale", FilterOperator.EQ, modelRimVerticali.getProperty("/formCedenteRicevente/PosFin/Reale")),
				new Filter("Fipex", FilterOperator.EQ, modelRimVerticali.getProperty("/formCedenteRicevente/PosFin/Fipex")),
				new Filter("Classificazione", FilterOperator.EQ, "FL")
			]
			if(modelRimVerticali.getProperty("/tablePosFinRicCed").length > 0){
				aFilters.push(new Filter({
					filters: modelRimVerticali.getProperty("/tablePosFinRicCed").map(el => new Filter("IdAutorizzazione", FilterOperator.NE, el.IdAutorizzazione)),
					and: true,
				  }))
			}
			modelHana.read("/AutorizzazioniSet",{
				filters: aFilters,
				success: (oData) =>{
					//debugger
					modelPosFin.setProperty("/busyAuth", false)
					modelPosFin.setProperty("/elencoAuth", oData.results)
				},
				error: (res) => {
					//debugger
					modelPosFin.setProperty("/busyAuth", false)
				}
			})
		},
		handleConfirmAuth: function (oEvent) {
			const modelRimVerticali = this.getView().getModel("modelRimVerticali")
			const modelPosFin = this.getOwnerComponent().getModel("modelPosFin")
			let selectedItem = modelPosFin.getProperty(oEvent.getParameter("selectedItem").getBindingContextPath());
			
			modelRimVerticali.setProperty("/formCedenteRicevente/DescrizioneCompatta", selectedItem.DescEstesa ? selectedItem.DescEstesa : selectedItem.DescrizioneCompatta)
			modelRimVerticali.setProperty("/formCedenteRicevente/Auth",selectedItem)
			modelRimVerticali.setProperty("/formCedenteRicevente/DescrInputAuthAssociata", selectedItem.ZzdescrEstesaFm ? selectedItem.ZzdescrEstesaFm : 'NULL')
			
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
		__getRiceventiPosFinCB: async function (oFormCodingBlock, infoSStr, oStrutturaAmmRes, modelRimVerticali, modelHana) {
			let aCodingBlockPromise = await this.__getRiceventiDaCedente(oFormCodingBlock, infoSStr, oStrutturaAmmRes, modelRimVerticali, modelHana)
			let aCodingBlock = aCodingBlockPromise.map(cbp => cbp[0])
			return Promise.all(aCodingBlock.map(cb => this.__getCoppiaPosFinCB(cb, modelHana)))
		},
		__getCoppiaPosFinCB: function (cb, modelHana) {
			return new Promise((resolve, reject) => {
				modelHana.read(`/PosizioneFinanziariaSet(Fikrs='${cb.PosFinFikrs}',Anno='${cb.PosFinAnno}',Fase='${cb.PosFinFase}',Fipex='${cb.PosFinFipex}',Reale='${cb.PosFinReale}')`, {
					success: (oDataPosFin, res) => {
						resolve({
							CodingBlock: cb,
							PosFin : oDataPosFin
						})
					},
					error: (res) => {
					}
				})
			})
		},
		__getRiceventiDaCedente: async function (oFormCodingBlock, infoSStr, oStrutturaAmmRes, modelRimVerticali, modelHana) {
			let aFiltersRice = [
					new Filter("CodiceStrumento", FilterOperator.EQ, infoSStr.CodiceStrumento),
					new Filter("CodiceStrumentoOri", FilterOperator.EQ, infoSStr.CodiceStrumentoOri),
					new Filter("CodiceSottostrumento", FilterOperator.EQ, infoSStr.CodiceSottostrumento),
					new Filter("Reale", FilterOperator.EQ, oFormCodingBlock.PosFin.Reale),
					new Filter("Fase", FilterOperator.EQ, oFormCodingBlock.PosFin.Fase),
					new Filter("Anno", FilterOperator.EQ, oFormCodingBlock.PosFin.Anno),
					new Filter("Fikrs", FilterOperator.EQ, oFormCodingBlock.PosFin.Fikrs),
					new Filter("Fipex", FilterOperator.EQ, oFormCodingBlock.PosFin.Fipex.replaceAll(".","")),
					new Filter("Autorizzazione", FilterOperator.EQ, oFormCodingBlock.Auth.IdAutorizzazione),
					new Filter("AnnoMov", FilterOperator.EQ, modelRimVerticali.getProperty("/Anno")),
					new Filter("StrAmmResp", FilterOperator.EQ, oStrutturaAmmRes["/StrutturaAmministrativaCentraleSet"].Fictr)
				]
			let aRiceventi = await this.__getDataPromise("/RimodulazioniVerticaliSet", aFiltersRice, modelHana)
			if(aRiceventi.length > 0)
				MessageBox.show(`${aRiceventi.length === 1 ? 'É stata trovata ' : "Sono state trovate"} ${aRiceventi.length} ${aRiceventi.length === 1 ? 'ricevente collegata': 'riceventi collegate'} alla cedente selezionata`)
			return Promise.all(aRiceventi.map(ricevente => this.__getDataPromise("/AutorizzazioniSet",
																				[
																					new Filter("Reale", FilterOperator.EQ, ricevente.Reale),
																					new Filter("Fase", FilterOperator.EQ, ricevente.Fase),
																					new Filter("Anno", FilterOperator.EQ, ricevente.Anno),
																					new Filter("Fikrs", FilterOperator.EQ, ricevente.Fikrs),
																					new Filter("IdAutorizzazione", FilterOperator.EQ, ricevente.Autorizzazione),
																					new Filter("Fipex", FilterOperator.EQ, ricevente.Fipex),
																					new Filter("Fictr", FilterOperator.EQ, ricevente.StrAmmResp),
																					new Filter("Datbis", FilterOperator.GE, new Date())
																				]
																				, modelHana)))
		},
		onDeleteCB: function (oEvent) {
			const modelRimVerticali = this.getView().getModel("modelRimVerticali")
			let aCB = modelRimVerticali.getProperty("/tablePosFinRicCed")
			let sPathToDelete = oEvent.getSource().getParent().getBindingContextPath()
			let sIndex = sPathToDelete.split("/")[sPathToDelete.split("/").length - 1]
			aCB.splice( Number(sIndex), 1)
			modelRimVerticali.setProperty("/tablePosFinRicCed", aCB)
		},
		onPressResetta: function () {
			const modelRimVerticali = this.getView().getModel("modelRimVerticali")
			modelRimVerticali.setProperty("/tablePosFinRicCed", [])
			modelRimVerticali.setProperty("/Anno", null)
			modelRimVerticali.setProperty("/visibleRiceCede", false)
			modelRimVerticali.setProperty("/disableModificaRicerca", false)
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

		/**
		 * Event handler 
		 * 
		 * @param {sap.ui.base.Event} oEvent - Event class
		 * @public
		 */
		onExpandPopOverAutorizzazione: function (oEvent) {
			var oButton = oEvent.getSource(),
			oView = this.getView();

			// create popover
			if (!this._pPopoverSottoStr) {
				this._pPopoverSottoStr = Fragment.load({
					id: oView.getId(),
					name: "zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.PopOverAutorizzazione",
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

		onPressAvvioSac: function (oEvent) {
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			const modelRimVerticali = this.getView().getModel("modelRimVerticali")
			const modelPosFin = this.getOwnerComponent().getModel("modelPosFin")
			let aCBCheck = modelRimVerticali.getProperty("/tablePosFinRicCed")
			if(aCBCheck.find(cb => cb.CedeRice === "CEDENTE") && aCBCheck.find(cb => cb.CedeRice === "RICEVENTE") ) {
				this.getView().setBusy(true)
				let  VarMulti =  ( async () => {
								let aCB = modelRimVerticali.getProperty("/tablePosFinRicCed")
								let aVarMulti = []
								for(let i = 0; i < aCB.length; i++) {
									let oStrutturaAmmRes = await this._getEntitySet("/StrutturaAmministrativaCentraleSet",
														[
															new Filter("Fikrs", FilterOperator.EQ, aCB[i].Fikrs),
															new Filter("Fase", FilterOperator.EQ, aCB[i].Fase),
															new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
															new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
															new Filter("Eos", FilterOperator.EQ, aCB[i].Eos),
															new Filter("Datbis", FilterOperator.GE,  new Date()),
															new Filter("Prctr", FilterOperator.EQ, aCB[i].Prctr),
															new Filter("CodiceCdr", FilterOperator.EQ, aCB[i].Cdr),
															new Filter("CodiceRagioneria", FilterOperator.EQ, aCB[i].Ragioneria),
															new Filter("CodiceUfficio", FilterOperator.EQ, '0000')
														]
														,modelHana)
									aVarMulti.push({
										SemObj : "GEST_POSFIN",
										Schermata: "RIM_VERT",
										Anno: modelRimVerticali.getProperty("/Anno"),
										IdPosfin: aCB[i].Fipex,
										CodiFincode:aCB[i].IdAutorizzazione,
										IdStAmmResp: oStrutturaAmmRes["/StrutturaAmministrativaCentraleSet"].Fictr,
										CodiceStrumento: modelPosFin.getProperty("/infoSottoStrumento/CodiceStrumento"),
										CodiceStrumentoOri: modelPosFin.getProperty("/infoSottoStrumento/CodiceStrumentoOri"),
										CodiceSottostrumento: modelPosFin.getProperty("/infoSottoStrumento/CodiceSottostrumento"),
										TipoRimod: aCB[i].CedeRice,
										Capitolo: aCB[i].Capitolo,
										Prctr : aCB[i].Prctr
									})
								}
								return aVarMulti 
							})()
				VarMulti.then((res) => {
					let payload = {
						SemObj: "GEST_POSFIN",
						Schermata: "RIM_VERT",
						VarMulti: [...res]
					}
					modelHana.create("/SacUrlSet", payload,{
						success:  (oData, res) => {
							//debugger
							this.getView().setBusy(false)
							let oRimVerticaliSac = this.getView().byId("linkSac");
							document.getElementById(oRimVerticaliSac.getId()).setAttribute("src", oData.Url);
							window.frames[0].location = oData.Url + (new Date());
							modelRimVerticali.setProperty("/disableModificaRicerca", true)
						},
						error: (res) => {
							//debugger
							this.getView().setBusy(false)
							return MessageBox.error("Errore")
						}
					})
				})
			} else {
				if(!aCBCheck.find(cb => cb.CedeRice === "CEDENTE")) {
					return MessageBox.error("Inserire un Cedente")
				} 
				if(!aCBCheck.find(cb => cb.CedeRice === "RICEVENTE")){
					return MessageBox.error("Inserire almeno un Ricevente")
				}
			}
		},
		onExpandPopOverAuth: function (oEvent) {
			const oView = this.getView()
			const oButton = oEvent.getSource()
			const modelRimVerticali = this.getView().getModel("modelRimVerticali")
			let sPath= oEvent.getSource().getParent().getBindingContextPath()
			let oAuth = modelRimVerticali.getProperty(sPath)
			modelRimVerticali.setProperty("/infoAuth", {
				...oAuth
			})

			// create popover
			if (!this._pPopoverAuth) {
				this._pPopoverAuth = Fragment.load({
					id: oView.getId(),
					name: "zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.HVRimVerticali.PopOverAutorizzazione",
					controller: this
				}).then(function(oPopover) {
					oView.addDependent(oPopover);
					return oPopover;
				});
			}
			this._pPopoverAuth.then(function(oPopover) {
				oPopover.openBy(oButton);
			});
		}
    });
});