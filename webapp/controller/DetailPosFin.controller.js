sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/core/Fragment",
	"sap/m/MessageBox",
	"sap/ui/core/syncStyleClass",
	"z_s4_crosslock/crosslock/controls/Lock",
	"sap/ui/core/routing/History",
	"sap/m/library",
	"./BaseController",
	"sap/ui/core/format/NumberFormat",
	"../model/formatter",
	"../model/models",
], function(Controller, JSONModel, Filter, FilterOperator, Fragment, MessageBox, syncStyleClass,Lock, History, mobileLibrary, BaseController, NumberFormat, formatter, models) {
	"use strict";
	var DialogType = mobileLibrary.DialogType;
	var variabGlobal;
	return BaseController.extend("zsap.com.r3.cobi.s4.gestposfinnv.controller.DetailPosFin", {
		/**
		 * @override
		 */
		Lock: Lock,
		formatter: formatter,
		onInit: async function() {
			this.getView().setModel(new JSONModel({
				detailAnagrafica: {}
			}), "modelPosFin")
		
			var oRouter = this.getOwnerComponent().getRouter();
			oRouter.getRoute("DetailPosFin").attachPatternMatched(this._onObjectMatched, this);
			var that = this;
			window.addEventListener('beforeunload', async function(oEvent) {
				console.log(`la proprietà unlock è: ${that.unlock} , arriva da addEventListener`);
				if(that.unlock) await that.unLockPosFin();
			});
			this.firstTime = true;
			//! LT nuova logica quadri FIORI
			this.createModelAnnoSelect();
			this.setModelFilter();								
			variabGlobal = this;
			this.functionTemp("idTableyear", "idColumnListItemsYear", "modelTable", "ImportoCPAnno", "Competenza");
			this.functionTemp("RimidTableyear", "RimidColumnListItemsYear", "modelTable", "ImportoCPAnno", "Competenza");
			this.functionTemp("idTableyearCassa", "idColumnListItemsYearCassa", "modelTableCassa", "ImportoCPAnno", "Competenza");
			this.functionTemp("idTableyearCassa", "idColumnListItemsYearCassa", "modelTableCassa", "ImportoCSAnno", "Cassa");
		//	this.functionTemp("idTableyearQuadro", "idColumnListItemsYearQuadro", "modelTableQuadro", "ImportoCPAnno", "Competenza");
		//	this.functionTemp("idTableyearQuadro", "idColumnListItemsYearQuadro", "modelTableQuadro", "ImportoCSAnno", "Cassa");
			this.firstTime = false;
			this.open = false;
			
		},
		__getCapitoloPG: function () {
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getView().getModel("modelPosFin")
			let filterCapitoloPG = [new Filter("Fikrs", FilterOperator.EQ, "S001"),
			new Filter("Fase", FilterOperator.EQ, "NV"),
			new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
			new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
			new Filter("Datbis", FilterOperator.GE, new Date()),
			new Filter("Eos", FilterOperator.EQ, "S")
									]
			if(modelPosFin.getProperty("/DominioSStr/Amministrazione").length > 0) {
				filterCapitoloPG.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Amministrazione"), "Prctr"))
			}
			return new Promise((resolve, reject) => {
				modelHana.read("/TipCapitoloSet",{
					filters: filterCapitoloPG,
					success: (oData) => {
						//debugger
						modelPosFin.setProperty("/formPosFin/capitoli", function() {
							let aCapitoli = []
							
							for(let i = 0; i < oData.results.length; i++){
								if(oData.results[i].Eos === "S")
									if(aCapitoli.filter(item => (item.Prctr === oData.results[i].Prctr && item.Capitolo === oData.results[i].Capitolo)).length === 0)
										aCapitoli.push(oData.results[i])
							}
							return aCapitoli
						}())
						modelPosFin.setProperty("/formPosFin/pg", oData.results)
						resolve()
					},
					error:  (err) => {
						//debugger
						resolve(err)
					}
				})
			})
		},
		__getHVAmministrazione: function () {
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getView().getModel("modelPosFin")
			let filtersAmm = [new Filter("Fikrs", FilterOperator.EQ, "S001"),
									  new Filter("Fase", FilterOperator.EQ, "NV"),
									  new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
									//   new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
									  new Filter("Datbis", FilterOperator.GE, new Date())
									]
			if(modelPosFin.getProperty("/infoSottoStrumento/Reale") == "S")
				filtersAmm.push(new Filter({
					filters: [
								new Filter("Reale", FilterOperator.EQ, "R"),
								new Filter("Reale", FilterOperator.EQ, "S0001")
							],
					and : false
				}))
			else
				filtersAmm.push(new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")))

			//Estrazione Amm, Capitolo, Pg, Azione, Cdr, Programma e Missione
			if(modelPosFin.getProperty("/DominioSStr/Amministrazione").length > 0) {
				filtersAmm.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Amministrazione"), "Prctr"))
			}
			return new Promise((resolve, reject) => {
				modelHana.read("/TipAmministrazioneSet",{
					filters: filtersAmm,
					urlParameters: {
						$expand: "TipCdr"
					},
					success: (oData) => {
						//debugger
						modelPosFin.setProperty("/formPosFin/amministrazioni", oData.results)
						if(modelPosFin.getProperty("/infoSottoStrumento/DomAmministrazione/results").length === 1){
							modelPosFin.setProperty("/detailAnagrafica/AMMINISTAZIONE", oData.results[0].Prctr)
							modelPosFin.setProperty("/detailAnagrafica/DESC_AMMINISTAZIONE", oData.results[0].DescEstesa)
						}
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
						resolve()
					},
					error:  (err) => {
						//debugger
						resolve(err)
					}
				})
			})
		},
		__getHVMissione: function () {
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getView().getModel("modelPosFin")
			let filtersMissione = [new Filter("Fikrs", FilterOperator.EQ, "S001"),
									new Filter("Fase", FilterOperator.EQ, "NV"),
									new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
									new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale"))]

			//Inizio Estrazione Missioni, Programmi e Azioni
			if(modelPosFin.getProperty("/DominioSStr/Missione").length > 0) {
				filtersMissione.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Missione"), "Missione"))
				filtersMissione.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Programma"), "Programma"))
				filtersMissione.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Azione"), "Azione"))
			}
			if(modelPosFin.getProperty("/DominioSStr/Amministrazione"))
				filtersMissione.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Amministrazione"), "Prctr"))
			
			return new Promise((resolve, reject) => {
				modelHana.read("/TipMissioneSet",{
					filters: filtersMissione,
					success:  (oData) => {
						modelPosFin.setProperty("/formPosFin/missioni", function() {
							let aMissioni = []
								for(let i = 0; i <  oData.results.length; i++){
										if(aMissioni.filter(item => (item.Missione === oData.results[i].Missione)).length === 0)
											aMissioni.push(oData.results[i])
								}
							return aMissioni
						}())
						modelPosFin.setProperty("/formPosFin/programmi", function() {
							let aProgrammi = []
								for(let i = 0; i <  oData.results.length; i++){
									if(modelPosFin.getProperty("/DominioSStr/Programma").length > 0) {
										if(modelPosFin.getProperty("/DominioSStr/Programma").find(item => item.Missione === oData.results[i].Missione &&
																										item.Programma === oData.results[i].Programma))
											if(aProgrammi.filter(item => (item.Missione === oData.results[i].Missione &&
																		item.Programma === oData.results[i].Programma)).length === 0)
												aProgrammi.push(oData.results[i])
									} else {
										if(aProgrammi.filter(item => (item.Missione === oData.results[i].Missione &&
											item.Programma === oData.results[i].Programma)).length === 0)
												aProgrammi.push(oData.results[i])
									}
								}
							return aProgrammi
						}())
						modelPosFin.setProperty("/formPosFin/azioni", function () {
							let aAzioni = []
								for(let i = 0; i <  oData.results.length; i++){
									if(modelPosFin.getProperty("/DominioSStr/Azione").length > 0) {
										if(modelPosFin.getProperty("/DominioSStr/Azione").find(item => item.Missione === oData.results[i].Missione &&
																										item.Programma === oData.results[i].Programma &&
																										item.Azione === oData.results[i].Azione &&
																										item.Prctr === oData.results[i].Prctr))
											aAzioni.push(oData.results[i])
									} else {
										aAzioni.push(oData.results[i])
									}
								}
							return aAzioni
						}())
						resolve()
					},
					error: function (err) {
						//debugger
					}
				})
			})
			//Fine Estrazione Missioni, Programmi e Azioni
		},
		__getHVTitolo: function () {
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getView().getModel("modelPosFin")
			let filtersTitolo = [new Filter("Fikrs", FilterOperator.EQ, "S001"),
								new Filter("Fase", FilterOperator.EQ, "NV"),
								new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
								new Filter("Eos", FilterOperator.EQ, "S"),
								new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale"))]
			
								//Inizio Estrazione Titolo, Categoria, Ce2 e Ce3
			if(modelPosFin.getProperty("/infoSottoStrumento/DomTitolo/results").length > 0) {
				//creazione Filtri Titolo, Categoria, Ce2 e Ce3 nel caso sstr abbia dominio
				filtersTitolo.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Titolo"), "Titolo"))
				filtersTitolo.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Categoria"), "Categoria"))
				filtersTitolo.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Ce2"), "Ce2"))
				filtersTitolo.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Ce3"), "Ce3"))
			}
			return new Promise((resolve, reject) => {
				modelHana.read("/TipTitoloSet",{
					filters: filtersTitolo,
					success: (oData, res) => {
						modelPosFin.setProperty("/formPosFin/titoli", function() {
							let aTitoli = []
							for(let i = 0; i < oData.results.length; i++)
							if(modelPosFin.getProperty("/DominioSStr/Titolo").length > 0){
								if(modelPosFin.getProperty("/DominioSStr/Titolo").find(item => item.Titolo === oData.results[i].Titolo))
									if(aTitoli.filter(item => item.Titolo === oData.results[i].Titolo).length === 0 )
										aTitoli.push(oData.results[i])
							} else {
								if(aTitoli.filter(item => item.Titolo === oData.results[i].Titolo).length === 0 )
									aTitoli.push(oData.results[i])
							}
							return aTitoli
						}())
						modelPosFin.setProperty("/formPosFin/categorie", function() {
							let aCategoria = []
							for(let i = 0; i < oData.results.length; i++)
								if(modelPosFin.getProperty("/DominioSStr/Categoria").length > 0){
									if(modelPosFin.getProperty("/DominioSStr/Categoria").find(item => item.Titolo === oData.results[i].Titolo && item.Categoria === oData.results[i].Categoria))
										if(aCategoria.filter(item => item.Titolo === oData.results[i].Titolo &&
																item.Categoria === oData.results[i].Categoria).length === 0 )
											aCategoria.push(oData.results[i])
								} else {
									if(aCategoria.filter(item => item.Titolo === oData.results[i].Titolo &&
										item.Categoria === oData.results[i].Categoria).length === 0 )
										aCategoria.push(oData.results[i])
								}
							return aCategoria
						}())
						modelPosFin.setProperty("/formPosFin/ce2", function() {
							let aCe2 = []
							for(let i = 0; i < oData.results.length; i++)
								if(modelPosFin.getProperty("/DominioSStr/Ce2").length > 0) {
									if(modelPosFin.getProperty("/DominioSStr/Ce2").find(item => item.Titolo === oData.results[i].Titolo &&
																									item.Categoria === oData.results[i].Categoria &&
																									item.Ce2 === oData.results[i].Ce2))
										if(aCe2.filter(item => item.Titolo === oData.results[i].Titolo &&
																	item.Categoria === oData.results[i].Categoria &&
																	item.Ce2 === oData.results[i].Ce2).length === 0 )
											aCe2.push(oData.results[i])
								} else {
									if(aCe2.filter(item => item.Titolo === oData.results[i].Titolo &&
										item.Categoria === oData.results[i].Categoria &&
										item.Ce2 === oData.results[i].Ce2).length === 0 )
										aCe2.push(oData.results[i])
								}
							return aCe2
						}())
						modelPosFin.setProperty("/formPosFin/ce3", function() {
							let aCe3 = []
							for(let i = 0; i < oData.results.length; i++)
								if(modelPosFin.getProperty("/DominioSStr/Ce3").length > 0) {
									if(modelPosFin.getProperty("/DominioSStr/Ce3").find(item => item.Titolo === oData.results[i].Titolo &&
																									item.Categoria === oData.results[i].Categoria &&
																									item.Ce2 === oData.results[i].Ce2  &&
																									item.Ce3 === oData.results[i].Ce3))
										if(aCe3.filter(item => item.Titolo === oData.results[i].Titolo &&
																	item.Categoria === oData.results[i].Categoria &&
																	item.Ce2 === oData.results[i].Ce2 && item.Ce3 === oData.results[i].Ce3).length === 0 )
											aCe3.push(oData.results[i])
								} else {
									if(aCe3.filter(item => item.Titolo === oData.results[i].Titolo &&
										item.Categoria === oData.results[i].Categoria &&
										item.Ce2 === oData.results[i].Ce2 && item.Ce3 === oData.results[i].Ce3).length === 0 )
										aCe3.push(oData.results[i])
								}
							return aCe3
						}())
						resolve()
					}
				})
			})
			//Fine estrazione Titolo, Categoria, Ce2 e Ce3
		},
		__getHVRagioneria: function () {
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getView().getModel("modelPosFin")
			let filtersRagioneria = [new Filter("Fikrs", FilterOperator.EQ, "S001"),
									new Filter("Fase", FilterOperator.EQ, "NV"),
									new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
									new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale"))]
			//Inizio Estrazione Ragioneria
			return new Promise((resolve, reject) => {
				modelHana.read("/RelazioneAmminRagioneriaSet", {
					filters: filtersRagioneria,
					success: (oData) => {
						modelPosFin.setProperty("/formPosFin/ragionerie", oData.results)
						resolve()
					}
				})
			})
			//Fine Estrazione Ragioneria
		},
		__getHVMac: function () {
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getView().getModel("modelPosFin")
			//Inizio Estrazione Mac
			return new Promise((resolve, reject) => {
				modelHana.read("/MacSet", {
					success: (oData) => {
						modelPosFin.setProperty("/formPosFin/mac", oData.results)
						resolve()
					}
				})
			})
			//Fine Estrazione Mac	
		},
		__getTipoFondo: function () {
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getView().getModel("modelPosFin")
			let filterTipoFondo = [new Filter("Fikrs", FilterOperator.EQ, "S001"),
									new Filter("Fase", FilterOperator.EQ, "NV"),
									new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
									// new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale"))
								]
			if(modelPosFin.getProperty("/infoSottoStrumento/Reale") == "S")
				filterTipoFondo.push(new Filter({
					filters: [
								new Filter("Reale", FilterOperator.EQ, "R"),
								new Filter("Reale", FilterOperator.EQ, "S0001")
							],
					and : false
				}))
			else
				filterTipoFondo.push(new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")))
			//Inizio Estrazione Tipo Fondo
			return new Promise((resolve, reject) => {
				modelHana.read("/TipoFondoSet", {
					filters: filterTipoFondo,
					success: (oData) => {
						oData.results.unshift({CodiceTipoFondo: null, DescEstesa: null})
						modelPosFin.setProperty("/formPosFin/tipofondo", oData.results)
						resolve()
					}
				})
			})
			//Fine Estrazione Tipo Fondo	
		},
		__getHVCodiceStandard: function () {
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getView().getModel("modelPosFin")
			let filterCodiceStandard = [new Filter("Fikrs", FilterOperator.EQ, "S001"),
									new Filter("Fase", FilterOperator.EQ, "NV"),
									new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
									// new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
									new Filter("Datbis", FilterOperator.GE, new Date())
								]
			if(modelPosFin.getProperty("/infoSottoStrumento/Reale") == "S")
				filterCodiceStandard.push(new Filter({
					filters: [
								new Filter("Reale", FilterOperator.EQ, "R"),
								new Filter("Reale", FilterOperator.EQ, "S0001")
							],
					and : false
				}))
			else
				filterCodiceStandard.push(new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")))
			//Inizio Estrazione Codici Standard
			return new Promise((resolve, reject) => {
				modelHana.read("/CodiceStandardSet", {
					filters: filterCodiceStandard,
					success: (oData) => {
						modelPosFin.setProperty("/formPosFin/codiceStandard", oData.results)
						resolve()
					}
				})
			})
			//Fine Estrazione Codici Standard	
		},
		__getHVAreaInterventi: function () {
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getView().getModel("modelPosFin")
			return new Promise((resolve, reject) => {
				modelHana.read("/AreaInterventiSet", {
					success: (oData) => {
						oData.results.unshift({AreaDestinataria: "", Desc: ""})
						modelPosFin.setProperty("/formPosFin/AreaInterventi", oData.results)
						resolve()
					}
				})
			})
		}, 
		__setCofog: function (oPosFin) {
			let modelPosFin = this.getView().getModel("modelPosFin")
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let aFilters = [
					new Filter("Fikrs", FilterOperator.EQ, "S001"),
					new Filter("Fase", FilterOperator.EQ, "NV"),
					new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
					// new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
					new Filter("Fipex", FilterOperator.EQ, oPosFin.Fipex.replaceAll(".", ""))
					//new Filter("Versione", FilterOperator.EQ, oPosFin.Versione)
				]
			if(oPosFin.Reale == "S0001")
				aFilters.push(new Filter({
					filters: [
								new Filter("Reale", FilterOperator.EQ, "R"),
								new Filter("Reale", FilterOperator.EQ, "S0001")
							],
					and : false
				}))
			else
				aFilters.push(new Filter("Reale", FilterOperator.EQ, oPosFin.Reale))

			return new Promise( (resolve, reject) => {
				modelHana.read("/DistribuzioneCofogSet", {
					filters: aFilters,
					success:  async (oData) =>  {
						oData.results = oData.results.filter((arr, index, self) =>
							index === self.findIndex((t) => (t.CofogL1 === arr.CofogL1 && t.CofogL2 === arr.CofogL2  && t.CofogL3 === arr.CofogL3 )))
							//estrazione descrizioni cofog
							for(let i = 0; i < oData.results.length; i++){
								let sDesc = await this.__getDescCofog(oData.results[i])
								oData.results[i].Desc = sDesc
								oData.results[i].PercCofog = Number(oData.results[i].PercCofog)
							}
							//fine descrizioni cofog
							modelPosFin.setProperty("/detailAnagrafica/elencoCOFOG", oData.results)
							resolve()
					}
				})	
			})
		},
		__setElenchi: function (oPosFin) {
			let modelPosFin = this.getView().getModel("modelPosFin")
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let filtersElenchi = [	new Filter("Fikrs", FilterOperator.EQ, "S001"),
									new Filter("Fase", FilterOperator.EQ, "NV"),
									new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
									// new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
									new Filter("Eos", FilterOperator.EQ, oPosFin.Eos),
									new Filter("Capitolo", FilterOperator.EQ, oPosFin.Capitolo),
									new Filter("Prctr", FilterOperator.EQ, oPosFin.Prctr),
									new Filter({
										filters: [new Filter("PrctrElenco", FilterOperator.EQ, oPosFin.Prctr),
												new Filter("PrctrElenco", FilterOperator.EQ, "A020")
												],
										and: false,
			  						})
								]
			if(oPosFin.Reale == "S0001")
				filtersElenchi.push(new Filter({
						filters: [
									new Filter("Reale", FilterOperator.EQ, "R"),
									new Filter("Reale", FilterOperator.EQ, "S0001")
								],
						and : false
						}))
			else
				filtersElenchi.push(new Filter("Reale", FilterOperator.EQ, oPosFin.Reale))

			if(modelPosFin.getProperty("/onModify"))
				filtersElenchi.push(new Filter({
										filters: [
													new Filter("Pg", FilterOperator.EQ, "00"),
													new Filter("Pg", FilterOperator.EQ, oPosFin.Pg)
												],
										and: false,
									}))
			else 
				filtersElenchi.push(new Filter("Pg", FilterOperator.EQ, "00"))
			return new Promise( (resolve, reject) => {
				modelHana.read("/CapitoloElencoSet", {
					filters: filtersElenchi,
					success:  async (oData) =>  {
						oData.results = oData.results.filter((arr, index, self) =>
									index === self.findIndex((t) => (t.PrctrElenco === arr.PrctrElenco && t.Prctr === arr.Prctr && t.NumeroElenco === arr.NumeroElenco)))
						for(let i = 0; i < oData.results.length; i++) {
							let sDesc = await this.__getDescElenco(oData.results[i])
							oData.results[i].Desc = sDesc
						}
						modelPosFin.setProperty("/detailAnagrafica/elenchiCapitolo", oData.results)
						resolve()
					}
				})
			})
		},
		__getNOIPA: function () {
			let modelPosFin = this.getView().getModel("modelPosFin")
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			return new Promise( (resolve, reject) => {
				modelHana.read("/NoipaSet", {
					success: (oData) =>  {
						modelPosFin.setProperty("/formPosFin/Noipa", oData.results)
						resolve()
					}
				})
			})
		},
		__removeDuplicateDomSStr: function () {
			let modelPosFin = this.getView().getModel("modelPosFin")
			let oSottoStrumento = modelPosFin.getProperty("/infoSottoStrumento/")

			//rimuovo duplicati Amministrazione e valorizzo proprietà modello
			modelPosFin.setProperty("/DominioSStr/Amministrazione",  oSottoStrumento.DomAmministrazione.results)

			//rimozione duplicati Missione e valorizzo proprietà modello
			modelPosFin.setProperty("/DominioSStr/Missione",  function() {
				let aMissioni = []
				for(let i = 0; i < oSottoStrumento.DomMissione.results.length ; i++) {
					if(!aMissioni.find(item => item.Missione === oSottoStrumento.DomMissione.results[i].Missione))
						aMissioni.push(oSottoStrumento.DomMissione.results[i])
				}
				return aMissioni 
			}())
			//rimozione duplicati Missione e valorizzo proprietà modello
			modelPosFin.setProperty("/DominioSStr/Programma",  function() {
				let aProgrami = []
				for(let i = 0; i < oSottoStrumento.DomMissione.results.length ; i++) {
					if(!aProgrami.find(item => item.Missione === oSottoStrumento.DomMissione.results[i].Missione &&
											   item.Programma === oSottoStrumento.DomMissione.results[i].Programma))
						aProgrami.push(oSottoStrumento.DomMissione.results[i])
				}
				return aProgrami 
			}())

			//Azione
			modelPosFin.setProperty("/DominioSStr/Azione", oSottoStrumento.DomMissione.results)

			//rimozione duplicati Titolo
			modelPosFin.setProperty("/DominioSStr/Titolo", function() {
				let aTitoli = []
				for(let i = 0; i < oSottoStrumento.DomTitolo.results.length ; i++) {
					if(!aTitoli.find(item => item.Titolo === oSottoStrumento.DomTitolo.results[i].Titolo))
						aTitoli.push(oSottoStrumento.DomTitolo.results[i])
				}
				return aTitoli 
			}())
			//rimozione duplicati Categoria
			modelPosFin.setProperty("/DominioSStr/Categoria", function() {
				let aCat = []
				for(let i = 0; i < oSottoStrumento.DomTitolo.results.length ; i++) {
					if(!aCat.find(item => item.Titolo === oSottoStrumento.DomTitolo.results[i].Titolo &&
											 item.Categoria === oSottoStrumento.DomTitolo.results[i].Categoria))
						aCat.push(oSottoStrumento.DomTitolo.results[i])
				}
				return aCat 
			}())
			//rimozione duplicati Ce2
			modelPosFin.setProperty("/DominioSStr/Ce2", function() {
				let aCe2 = []
				for(let i = 0; i < oSottoStrumento.DomTitolo.results.length ; i++) {
					if(!aCe2.find(item => item.Titolo === oSottoStrumento.DomTitolo.results[i].Titolo &&
											item.Categoria === oSottoStrumento.DomTitolo.results[i].Categoria &&
											 item.Ce2 === oSottoStrumento.DomTitolo.results[i].Ce2))
						aCe2.push(oSottoStrumento.DomTitolo.results[i])
				}
				return aCe2 
			}())
			//Ce3
			modelPosFin.setProperty("/DominioSStr/Ce3", oSottoStrumento.DomTitolo.results)
		},
		_getSemObject: function(){
			return "GEST_POSFIN";
		},

		_getSchermataSac: function(sTypeSac){
			let sSchermata = null;
			switch(sTypeSac){
				case "cassaSac":
					sSchermata = "CASSA";
				break;
				case "competenzaSac":
					sSchermata = "COMPETENZA";
				break;
				case "rimOrizzSAC":
					sSchermata = "RIM_ORIZ";
				break;
				default: 
					break;
			}
			return sSchermata;
		},

		_getSacParams: function(sSchermata){
			let oModelPosFin = this.getView().getModel("modelPosFin");
			let oPosFin = oModelPosFin.getProperty("/PosFin/");
			let oSst = oModelPosFin.getProperty("/infoSottoStrumento");
			let oAut = oModelPosFin.getProperty("/CompetenzaAuth/Auth");
			let oAutCollegata = oModelPosFin.getProperty("/CompetenzaAuth/AuthAssociata");
			let oAmResp = oModelPosFin.getProperty("/strutturaAmminCentrale/Fictr");

			let oParams = {
				"Ammin" : oPosFin.Prctr || "",
				// "Aut" : oAut.IdAutorizzazione,
				// "AutColl" : oAutCollegata ? oAutCollegata.SeqFondoLe : "",
				"Cap" : oPosFin.Capitolo || "",
				"PosFin" : oPosFin.Fipex.replace(".","").replace(".","") || "",
				//"PosFin" : oPosFin.Fipex || "",
				"Sstr" : oSst.CodiceSottostrumento || "",
				"Str" : oSst.CodiceStrumento || "",
				"StrOri" : oSst.CodiceStrumentoOri || "",
				"StAmResp" : oAmResp || ""
			};

			if(sSchermata === "COMPETENZA" && oAut){
				//oAut = "14090"
				oParams.Aut = oAut.IdAutorizzazione ? oAut.IdAutorizzazione : "";
				//oParams.Aut = oParams.Aut ? oParams.Aut : "";
				//oParams.AutColl = oParams.AutColl ? oParams.AutColl : "";
				
				oParams.AutColl = oAutCollegata ? oAutCollegata.SeqFondoLe : "";
			}
			if(sSchermata === "RIM_ORIZ"){
				//oAut = "14090"
				oParams.Aut = oAut.IdAutorizzazione ? oAut.IdAutorizzazione : "";
				//oParams.AutColl = oParams.AutColl ? oParams.AutColl : "";
				oParams.AutColl = oAutCollegata ? oAutCollegata.SeqFondoLe : "";
			}
			return oParams;
		},	

		_getIFrameUrlPromise: function(oPayload){

			let that = this;

			return { 
				oPayload,
				mPromise: oData => new Promise((res,rej)=>{
					let oModel = that.getOwnerComponent().getModel("sapHanaS2");

					oModel.create(
						"/VarSingSet",
						oData,
						{
							success: oRes => res({oResponse: oRes, oPayload: oData}),
							error: oRes => rej({oResponse: oRes, oPayload: oData})
						}
					);
				})
			};
		},

		loadIframe: async function(typeSac){
			//lt prova recupero iframe
			let that = this;
			let oModel = that.getOwnerComponent().getModel("sapHanaS2");
			const modelPosFin = this.getView().getModel("modelPosFin")
			const oPosFin = modelPosFin.getProperty("/PosFin")
			const infoSottostrumento = modelPosFin.getProperty("/infoSottoStrumento")
			let sSemObj = this._getSemObject();
			let sSchermata = this._getSchermataSac(typeSac);
			let oFields = this._getSacParams(sSchermata);
			
			let oPayload = {
				"SemObj": sSemObj,
				"SchedaSac": sSchermata,
				...oFields
			};

			let maxAuthScadenza = modelPosFin.getProperty("/CompetenzaAuth/MaxAuthScadenza");
			let minAuthAttivazione = modelPosFin.getProperty("/CompetenzaAuth/minAuthAttivazione");
			// BusyIndicator.show();
			let oPromise = this._getIFrameUrlPromise(oPayload);
			await oPromise.mPromise(oPromise.oPayload)
				.then(
					oRes => that.getOwnerComponent().getModel("iframe").setProperty("/" + typeSac, (() => {
						oRes.oResponse.Url = oRes.oResponse.Url + (oPosFin.StatusPg === "3" ? "&p_pian=0" :  "&p_pian=1" )
						oRes.oResponse.Url = oRes.oResponse.Url + (oPosFin.FlagMemcor01 === false ? "&p_memoria=1" : "&p_memoria=0")
						//lt aggiungo ai parametri anche la scadenza massima recuperata dalla lista delle autorizzazioni della pos fin						
						if(typeSac === "cassaSac") oRes.oResponse.Url = oRes.oResponse.Url + `&p_maxAuthScadenza=${maxAuthScadenza}` + `&p_minAuthAttivazione=${minAuthAttivazione}`;
						//lt -> inserisco come parametro se Reale o Simulato
						oRes.oResponse.Url = oRes.oResponse.Url + `&p_visibility=${infoSottostrumento.Reale}`						
						return oRes.oResponse.Url
					})()), //oRes.oResponse.Url
					oRes => that.openMessageBox("Error","Errore","Errore recupero scheda SAC")
				);
			// BusyIndicator.hide();
		},
		/* loadIframe: function(typeSac){
			//lt prova recupero iframe
			var that = this;
			var oFrame = that.getView().byId(typeSac);
			var url = this.getOwnerComponent().getModel("iframe").getProperty("/" + typeSac);
			that.urlSac = url;
			var oFrameContent = oFrame.$()[0];
			oFrameContent.setAttribute("src", that.urlSac);
			that._refresh();
		}, */
		_refresh: function() {
			var urlSac = this.urlSac;
			window.frames[0].location = urlSac + (new Date());
		},

		resetSrc: function(fromObjectMatched) {
			var icontab = this.getView().byId("idIconTabBarMulti");
			if(icontab && fromObjectMatched) icontab.setSelectedKey("info");

			var arrayId = ["cassaSac" ,"competenzaSac","rimOrizzSAC"];

			for (let i = 0; i < arrayId.length; i++) {
				const el = arrayId[i];
				var iFrame = this.getView().byId(el);

				if(iFrame && document.getElementById(iFrame.getId())) document.getElementById(iFrame.getId()).setAttribute("src", "");
			}
		},

		_onObjectMatched:async function (oEvent, objArgs) {
			

			const oKeysArgs = oEvent ? oEvent.getParameter("arguments") : objArgs;
			let modelPosFin = this.getView().getModel("modelPosFin")
			const modelHana = this.getOwnerComponent().getModel("sapHanaS2")

			await this.__getAnnoFaseProcessoMacroFase();
			//this.resetSrc(true);		
			this._resetModelTable()
			/* var icontab = this.getView().byId("idIconTabBarMulti");
			if(icontab) icontab.setSelectedKey("info");

			var arrayId = ["cassaSac" ,"competenzaSac","rimOrizzSAC"];

			for (let i = 0; i < arrayId.length; i++) {
				const el = arrayId[i];
				var iFrame = this.getView().byId(el);

				if(iFrame && document.getElementById(iFrame.getId())) document.getElementById(iFrame.getId()).setAttribute("src", "");
			} */

			var icontab = this.getView().byId("idIconTabBarMulti");
			if(icontab) icontab.setSelectedKey("info");

			//lt inserisco per le IRAP
			this.getView().setModel(new JSONModel([]), "fipexIrapSelected");
			this.getView().setModel(new JSONModel([]), "modelDeleteIrap");

			modelPosFin.setProperty("/gestioneCampiEditabili", { stato_pg: true, quadri : true})
			modelPosFin.setProperty("/formPosFin", {
				amministrazioni: [],
				capitoli: [],
				pg: [],
				cdr: [],
				missioni: [],
				programmi: [],
				azioni: [],
				titoli: [],
				categorie: [],
				ragionerie: [],
				mac: [],
				tipofondo: [],
				tipoSpesaCapitolo: [],
				tipoSpesaPG: [],
				codice_elenco: [],
				AreaInterventi: [],
				Noipa: []
			})
			modelPosFin.setProperty("/formAutorizzazione", {})
			modelPosFin.setProperty("/formCodingBlock", {})
			modelPosFin.setProperty("/CompetenzaAuth",{
				Auth: null,
				AuthAssociata: null,
				MaxAuthScadenza: null,
				minAuthAttivazione: null
			})
			modelPosFin.setProperty("/DominioSStr", {
				Amministrazione:[],
				Missione: [],
				Programma: [],
				Azione: [],
				Titolo: [],
				Categoria: [],
				Ce2: [],
				Ce3: []
			})
			modelPosFin.setProperty("/detailAnagrafica", {
				elencoCOFOG:[],
				elenchiCapitolo: [],
				lista_cofog: [],
				codice_elenco:[],
				PosizioneFinanziariaIrap: []
			})	
			modelPosFin.setProperty("/onAvvio", true)
			modelPosFin.setProperty("/tabAnagrafica", true)
			modelPosFin.setProperty("/faseRicerca", false)
			modelPosFin.setProperty("/onModify", true)
			modelPosFin.setProperty("/onCreate", false)
			modelPosFin.setProperty("/idCompetenzaTab", true)
			modelPosFin.setProperty("/idCassTab", true)
			//Richiamo Sottostrumento
			const sUrlSStr = `/SottostrumentoSet(Fikrs='${oKeysArgs.Fikrs}',CodiceStrumento='${oKeysArgs.CodiceStrumento}',CodiceStrumentoOri='${oKeysArgs.CodiceStrumentoOri}',CodiceSottostrumento='${oKeysArgs.CodiceSottostrumento}',Datbis=datetime'${encodeURIComponent(oKeysArgs.Datbis.replace(".000Z", ""))}')`
			const oSottostrumento = await this.__getKeyPromise(sUrlSStr, modelHana,  { $expand: "DomAmministrazione,DomTitolo,DomMissione"})
			
			modelPosFin.setProperty("/infoSottoStrumento", oSottostrumento)
			modelPosFin.setProperty("/Sottostrumento", `${oSottostrumento.DescTipoSstr} - ${oSottostrumento.NumeroSstr}`)
			this.__removeDuplicateDomSStr()

			this.getView().setBusy(true)
			if(!modelPosFin.getProperty("/onModify")) {
				this.__setVisibleFieldCreazione(modelPosFin)
				return new Promise( function(resolve, reject) {
					Promise.all([
								this.__getHVAmministrazione(), 
								this.__getCapitoloPG(),
								this.__getHVMissione(), 
								this.__getHVTitolo(), 
								this.__getHVRagioneria(), 
								this.__getHVMac(), 
								this.__getTipoFondo(), 
								this.__getHVCodiceStandard(), 
								this.__getHVAreaInterventi(),
								this.__getNOIPA()])
							.then(function(res){
								this.getView().setBusy(false)
							}.bind(this))
							.catch(err => {
								this.getView().setBusy(false)
								let oError = JSON.parse(err.responseText)
								MessageBox.error(oError.error.message.value)
							})
				}.bind(this))
			} else {
				return new Promise( async function(resolve, reject) {
					// let oPosFin = await this.__getPosFin()
					let oPosFin = await this.__getPosFin(`/PosizioneFinanziariaSet(Fikrs='${oKeysArgs.Fikrs}',Anno='${oKeysArgs.Anno}',Fase='${oKeysArgs.Fase}',Reale='${oKeysArgs.Reale}',Fipex='${oKeysArgs.Fipex}')`, modelHana)
					if(oPosFin.StatusPg === "1" || oPosFin.StatusPg === "0")
						this.__setVisibleFieldModifica(modelPosFin)
					modelPosFin.setProperty("/posFin", oPosFin.CodificaRepPf)
					modelPosFin.setProperty("/PosFin", oPosFin)
					//lt lock
					/* var sCheckLock = await this.checkLock( oPosFin);
					if (sCheckLock.bCheck === false) {			
						this.getView().setModel(new JSONModel({LOCKED:"X",MESSAGE:sCheckLock.MESSAGE}),"modelLocked");
						this.unlock = false
						this._messageBox(sCheckLock.MESSAGE, "error");
						console.log(`la proprietà unlock è: ${this.unlock} , arriva Bloccato con messaggio ${sCheckLock.MESSAGE}`);
					}else{
						this.unlock = true
						console.log(`la proprietà unlock è: ${this.unlock} , Non era bloccato e quindi viene bloccato in sessione`);
						this.getView().setModel(new JSONModel({LOCKED:"",MESSAGE:""}),"modelLocked");
					} */
					
					var sCheckLock = false
					//!lt 20240617 -> non effettuo il lock dell'app per cambio comportamento. Lock solo al salvataggio
					//this.unlock = true
					//console.log(`la proprietà unlock è: ${this.unlock} , Non era bloccato e quindi viene bloccato in sessione`);
					this.getView().setModel(new JSONModel({LOCKED:"",MESSAGE:""}),"modelLocked");

					let sKeyCheckSstr = `/CheckSottostrumentoSet(Fikrs='${oPosFin.Fikrs}',Anno='${oPosFin.Anno}',Fase='${oPosFin.Fase}',Reale='${oSottostrumento.Reale === 'S' ? 'S0001' : 'R'}',Eos='${oPosFin.Eos}',Prctr='${oPosFin.Prctr}',CodiceCapitolo='${oPosFin.Capitolo}')`		
					const responseCheckSottostrumentoVar = await this.__getKeyPromiseResolve(sKeyCheckSstr, modelHana)
					const controlloSottostrumento = await this._setCheckModifiable(oSottostrumento, responseCheckSottostrumentoVar, modelPosFin , sCheckLock.bCheck)
					const controlloFoglio = await this._setCheckFoglio(oPosFin, modelPosFin)

					if(!controlloSottostrumento.esito || !controlloFoglio.esito){
						let msg = [...controlloSottostrumento.msg,...controlloFoglio.msg]
						
						MessageBox.warning(msg.toString().replaceAll(".",".\n"))

					}
					//if(!controlloFoglio)
					Promise.all([
								this.__getHVAmministrazione(),
								this.__getStrutturaAmminCentrale(oPosFin),
								this.__setFieldAmmin(oPosFin), 
								this.__setCollegamenti(oPosFin), 
								this.__setFieldCapPg(oPosFin), 
								this.__setFieldTitolo(oPosFin), 
								this.__setFieldMissione(oPosFin), 
								this.__setFieldCdr(oPosFin),
								this.__setFieldRagioneria(oPosFin),
								this.__setFieldMac(oPosFin),
								this.__setFieldPosizioneFinanziariaIrap(oPosFin),
								this.__getHVMac(), 
								this.__getTipoFondo(), 
								this.__getHVCodiceStandard(), 
								this.__getHVAreaInterventi(),
								this.__setCofog(oPosFin),
								this.__setElenchi(oPosFin),
								this._getSingleAutorizzazione(),
								this.__getNOIPA()])
							.then(function(res){
								this.__setOtherFields(oPosFin)
								this.getView().setBusy(false)
								this.saveStringifyDetailAnagrafica();

								if(oPosFin.StatusPg === "3")
									this.setStateAttributiPosFinDisattiva(modelPosFin, false)
								//debugger
								/* if(!this.unlock){								
									modelPosFin.setProperty("/modificabile", false)	
									
									this.__setAllFieldNotModifiable(modelPosFin, false, false , false)
									console.log(`la proprietà unlock è true: ${this.unlock} , Setto tutti i campi non modificabili`);
									return
								} */

								//anagrafica non modificabile se sottostrumento ha tipologia esposizione su Rimodulazione Orizzontalee
								if( modelPosFin.getProperty("/infoSottoStrumento/TipoEsposizione") === "2"){
									this.__setAllFieldNotModifiable(modelPosFin, false)
									modelPosFin.setProperty("/gestioneCampiEditabili/quadri", true) 
								}
								//! LT se uno dei due controlli 
								if(!controlloSottostrumento.esito || !controlloFoglio.esito){
									this.__setAllFieldNotModifiable(modelPosFin, false, false)

									if(!controlloSottostrumento.esito && controlloFoglio.esito){
										modelPosFin.setProperty("/gestioneCampiEditabili/quadri", true)
									}							
									
								}
								
								
							}.bind(this))
							.catch(err => {
								this.getView().setBusy(false)
								let oError = JSON.parse(err.responseText)
								MessageBox.error(oError.error.message.value)
							})
				}.bind(this))
			}
		},
		saveStringifyDetailAnagrafica: function(){
			// creo una stringa comprensiva dei valori di detail anagrafica.
			let modelPosFin = this.getView().getModel("modelPosFin")
			let detailAnagrafica =  modelPosFin.getProperty("/detailAnagrafica")
			const detailStringify = JSON.stringify(detailAnagrafica)
			modelPosFin.setProperty("/stringifyAnagrafica", detailStringify)
		},
		
		_setCheckModifiable: async function (currentSStr, modifySStr, modelPosFin) {
			var response = {esito : true, msg : []}
			if(modifySStr !== null){

				const esercizio = this.getView().getModel("globalModel").getProperty("/ANNO")
				//!lt controllo l'anno 
				if(parseInt(modifySStr.CodiceSottostrumento.slice(0,4)) < parseInt(esercizio)){
					return response
				}

				let aFiltersSStr = [
					new Filter("Fikrs", FilterOperator.EQ, modifySStr.Fikrs),
					new Filter("CodiceStrumento", FilterOperator.EQ, modifySStr.CodiceStrumento),
					new Filter("CodiceStrumentoOri", FilterOperator.EQ, modifySStr.CodiceStrumentoOri),
					new Filter("CodiceSottostrumento", FilterOperator.EQ, modifySStr.CodiceSottostrumento),
					new Filter("Datbis", FilterOperator.GE, new Date()),
				]
				let sstrDiLavorazione = await this._getEntitySet('/SottostrumentoSet', aFiltersSStr, this.getOwnerComponent().getModel("sapHanaS2"))

				if(!sstrDiLavorazione['/SottostrumentoSet']){
					return response
				}

				if(currentSStr.TipoSstr == "52" && sstrDiLavorazione['/SottostrumentoSet'].TipoSstr == "51"){					
					return response
				}
				if(modifySStr.CodiceStrumento == currentSStr.CodiceStrumento && modifySStr.CodiceStrumentoOri == currentSStr.CodiceStrumentoOri &&
					modifySStr.CodiceSottostrumento == currentSStr.CodiceSottostrumento) {
						modelPosFin.setProperty("/modificabile", true)
						return response
				} else {
					modelPosFin.setProperty("/modificabile", false)
					//! LT 20240808 -> modifico la response per gestire meglio il controllo con il foglio  notizie
					response.esito = false
					response.msg = [`Il capitolo della posizione finanziaria selezionata è stato già modificato anagraficamente dal sottostrumento ${sstrDiLavorazione['/SottostrumentoSet'].DescTipoSstr} - ${sstrDiLavorazione['/SottostrumentoSet'].NumeroSstr}`] 
					return response
				}
			} else {
				modelPosFin.setProperty("/modificabile", true)
				return response
			}
		},
		_getSingleAutorizzazione: function () {
			//! this.getView().byId("idAuthComp").setBusy(true)
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getView().getModel("modelPosFin")
			let aFilters = [
				new Filter("Fikrs", FilterOperator.EQ, modelPosFin.getProperty("/PosFin/Fikrs")),
				new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/PosFin/Anno")),
				new Filter("Fase", FilterOperator.EQ,modelPosFin.getProperty("/PosFin/Fase")),
				new Filter("Reale", FilterOperator.EQ,modelPosFin.getProperty("/PosFin/Reale")),
				new Filter("Fipex", FilterOperator.EQ,modelPosFin.getProperty("/PosFin/Fipex")),
				new Filter("Classificazione", FilterOperator.NE, "E")
			]
			/* if(modelPosFin.getProperty("/infoSottoStrumento/TipoEsposizione") === '2')
				aFilters.push(new Filter("Classificazione", FilterOperator.EQ, "FL"))
			else 
				aFilters.push(new Filter("Classificazione", FilterOperator.NE, "E")) */
			modelHana.read("/AutorizzazioniSet",{
				filters: aFilters,
				success: (oData) =>{
					if(oData.results.length === 1){
						modelPosFin.setProperty("/CompetenzaAuth/AuthAssociata", null)
						modelPosFin.setProperty("/CompetenzaAuth/Auth",oData.results[0])
						modelPosFin.setProperty("/CompetenzaAuth/DescrInputAuth",oData.results[0].ZzdescrEstesaFm ? oData.results[0].ZzdescrEstesaFm : 'NULL')
					}
					//lt recupero tutte le interrogazioni per mandarle poi a SAC
					modelPosFin.setProperty("/CompetenzaAuth/MaxAuthScadenza", Math.max(...oData.results.map(o => o.Scadenza)))
					modelPosFin.setProperty("/CompetenzaAuth/minAuthAttivazione", Math.min(...oData.results.map(o => o.Attivazione)))
					//! this.getView().byId("idAuthComp").setBusy(false)
					
				},
				error: (res) => {					
					//! this.getView().byId("idAuthComp").setBusy(false)
				}
			})
		},
		__setVisibleFieldModifica: function (modelPosFin) {
			modelPosFin.setProperty("/gestioneCampiEditabili", {
				ammin: false,
				capitolo: false,
				pg: false,
				stato_pg: true,
				quadri : true
				// missione: false,
				// programma: false,
				// azione: false,
				// titolo: false,
				// categoria: false,
				// cdr: false,
				// ragioneria: false,
				// ce2: false,
				// ce3: false
			})
		},
		setStateAttributiPosFinDisattiva: function (modelPosFin, state) {
			modelPosFin.setProperty("/gestioneCampiEditabili", {
				ammin: false,
				capitolo: false,
				pg: false,
				missione: false,
				programma: false,
				azione: false,
				titolo: false,
				categoria: false,
				cdr: false,
				ragioneria: false,
				ce2: false,
				ce3: false,
				fofp: state,
				mac: state,
				tipofondo: state,
				tipoSpesaCapitolo: state,
				naturaSpesa: state,
				memoria: state,
				capitolone: state,
				cuirapnocu: state,
				noipa: state,
				CDCapitolo: state,
				den_estesa_capitolo: state,
				den_breve_capitolo: state,
				CDPg: state,
				den_breve_pg: state,
				den_estesa_pg: state,
				tipo_spesa_pg: state,
				area_destinataria: state,
				obiettivi_ministeri: state,
				ruoli_spesa_fissa: state,
				enableElenchi: state,
				enableCofog: state,
				stato_pg: modelPosFin.getProperty("/PosFin/StatusCapitolo") === '3' ? false : true
				/*,
				stato_capitolo: state*/
			})
		},
		__setAllFieldNotModifiable: function (modelPosFin, state, stato_pg) {
			modelPosFin.setProperty("/gestioneCampiEditabili", {
				ammin: false,
				capitolo: false,
				pg: false,
				missione: false,
				programma: false,
				azione: false,
				titolo: false,
				categoria: false,
				cdr: false,
				ragioneria: false,
				ce2: false,
				ce3: false,
				fofp: state,
				mac: state,
				tipofondo: state,
				tipoSpesaCapitolo: state,
				naturaSpesa: state,
				memoria: state,
				capitolone: state,
				cuirapnocu: state,
				noipa: state,
				CDCapitolo: state,
				den_estesa_capitolo: state,
				den_breve_capitolo: state,
				CDPg: state,
				den_breve_pg: state,
				den_estesa_pg: state,
				tipo_spesa_pg: state,
				area_destinataria: state,
				obiettivi_ministeri: state,
				ruoli_spesa_fissa: state,
				enableElenchi: state,
				enableCofog: state,
				stato_capitolo: state,
				quadri: state 
			})
			if(stato_pg === false){
				modelPosFin.setProperty("/gestioneCampiEditabili/stato_pg", false ) 
			} else {
				modelPosFin.setProperty("/gestioneCampiEditabili/stato_pg", true ) 
			}
		},
		__setVisibleFieldCreazione: function (modelPosFin) {
			modelPosFin.setProperty("/gestioneCampiEditabili", {
				ammin: true,
				capitolo: true,
				pg: true,
				missione: true,
				programma: true,
				azione: true,
				titolo: true,
				categoria: true,
				cdr: true,
				ragioneria: true,
				ce2: true,
				ce3: true
			})
		},
		__getPosFin: function (sUrl, modelHana) {
			return new Promise( function(resolve, reject) {
				modelHana.read(sUrl, {
					success: (oData) => {
						//debugger
						resolve(oData)
					},
					error: function (err) {
						//debugger
						reject()
					}
				})
			})
		},
		sorterAmmByNumericCode: function (a,b) {
			const subStrAmm1 = Number(a.substring(1, a.length))
			const subStrAmm2 = Number(b.substring(1, a.length))
			return subStrAmm1 - subStrAmm2;
		},
		sorterHVDomSStr: function (a, b) {
			return Number(a) - Number(b)
		},
		onHVFormPosFin: async function (oEvent) {
			let modelPosFin = this.getView().getModel("modelPosFin")
			this.__setBusyHelp(modelPosFin, true)
			let {_, value} = oEvent.getSource().getCustomData()[0].mProperties

			await this.__getDataForHV(value) //estrae i dati filtrati nel caso ci siano selezioni di attributi padre
			Fragment.load({
				name:"zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.HVPosFin." + value,
				controller: this
			}).then(oDialog => {
				this[value] = oDialog
				this.getView().addDependent(oDialog);
				this[value].open()
			})
		},
		__getDataForHV: async function name(sHV) {
			let modelPosFin = this.getView().getModel("modelPosFin")
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let aFilters = [new Filter("Fikrs", FilterOperator.EQ, "S001"),
							new Filter("Fase", FilterOperator.EQ, "NV"),
							new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
							// new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale"))
						]
			if(modelPosFin.getProperty("/infoSottoStrumento/Reale") == "S")
				aFilters.push(new Filter({
					filters: [
								new Filter("Reale", FilterOperator.EQ, "R"),
								new Filter("Reale", FilterOperator.EQ, "S0001")
							],
					and : false
				}))
			else
				aFilters.push(new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")))

			switch (sHV) {
				case "HVCapitolo":
					//se si apre capitolo, controllare che sia stato valorizzata Amministrazione e filtrare per tale valore
					if(modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE")){
						aFilters.push(new Filter("Prctr", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE")))
						aFilters.push(new Filter("Eos", FilterOperator.EQ, "S"))

						modelHana.read("/TipCapitoloSet",{
							filters: aFilters,
							success: (oData) => {
								modelPosFin.setProperty("/formPosFin/capitoli", function() {
									let aCapitoli = []
									
									for(let i = 0; i < oData.results.length; i++){
										if(oData.results[i].Eos === "S")
											if(aCapitoli.filter(item => (item.Prctr === oData.results[i].Prctr && item.Capitolo === oData.results[i].Capitolo)).length === 0)
												aCapitoli.push(oData.results[i])
									}
									return aCapitoli
								}())
								this.__setBusyHelp(modelPosFin, false)
							},
							error:  (err) => {
								this.__setBusyHelp(modelPosFin, false)
							}
						})
					}
					break;
				case "HVPg":
					//se è stato inserito un capitolo manualmente, non aggiornare la lista valori di Pg
					// if(modelPosFin.getProperty("/detailAnagrafica/CAPITOLO") && !modelPosFin.getProperty("/detailAnagrafica/DESC_CAPITOLO")) {
					// 	break
					// }
					//se si apre capitolo, controllare che sia stato valorizzata Amministrazione e filtrare per tale valore
						if(modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE")){
							aFilters.push(new Filter("Prctr", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE")))
						}
						 if(modelPosFin.getProperty("/detailAnagrafica/CAPITOLO")){
						 	aFilters.push(new Filter("Capitolo", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/CAPITOLO")))
						 }
						 aFilters.push(new Filter("Eos", FilterOperator.EQ, "S"))

						if(modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE") || modelPosFin.getProperty("/detailAnagrafica/CAPITOLO")) {
							modelHana.read("/TipCapitoloSet",{
								filters: aFilters,
								success: (oData) => {
									modelPosFin.setProperty("/formPosFin/pg", oData.results)
									this.__setBusyHelp(modelPosFin, false)
								},
								error:  (err) => {
									this.__setBusyHelp(modelPosFin, false)
								}
							})
					}
					break
					case "HVCdr":

					//se si apre help value di Cdr, controllare che sia stato valorizzata Amministrazione e filtrare per tale valore
					if(modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE")){
						let arrayCapitoli = [];
						let cloneCheckPosFin = [];
						if( modelPosFin.getProperty("/detailAnagrafica/MISSIONE") &&  modelPosFin.getProperty("/detailAnagrafica/PROGRAMMA")){
							
							let aFiltersPos = [	
								new Filter("Fikrs", FilterOperator.EQ, "S001"),
								new Filter("Fase", FilterOperator.EQ, "NV"),
								new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/PosFin/Anno")),
								new Filter("Datbis", FilterOperator.GE, new Date()),
								new Filter("Eos", FilterOperator.EQ, "S"),
								new Filter("Ammin", FilterOperator.EQ, modelPosFin.getProperty("/PosFin/Ammin")),
								new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/PosFin/Reale")),
								new Filter("Missione", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/MISSIONE")),
								new Filter("Programma", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/PROGRAMMA")),
						];
						//lt recupero tutte le pos fin con miss prog e autori
						let aCheckPosFin = await this.__getDataPromise("/PosizioneFinanziariaSet",
						aFiltersPos, modelHana);
						cloneCheckPosFin = jQuery.extend(true, [], aCheckPosFin)
						let capitoli = [...new Set(aCheckPosFin.map(item => item.Capitolo))].sort(); 
						if(!capitoli) capitoli = []						
						arrayCapitoli = capitoli;
						}
						aFilters.push(new Filter("Prctr", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE")))
						const aTipAmm = await this.__getDataPromise("/TipAmministrazioneSet",
							aFilters, modelHana, {
								$expand: "TipCdr"
							});
							
						let aCdr = []
						for(let i = 0; i <  aTipAmm.length; i++){
								aCdr.push(...aTipAmm[i].TipCdr.results)
						}
						if(arrayCapitoli.length > 1 && aCdr.length > 0 && cloneCheckPosFin.length > 0){
							aCdr = jQuery.grep(aCdr, function(record, pos) {
									return record.Cdr === cloneCheckPosFin[0].Cdr
								});  
						} 
						modelPosFin.setProperty("/formPosFin/cdr", aCdr)
						this.__setBusyHelp(modelPosFin, false)
					}
					break
					case "HVRagioneria":
						if(modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE")){
							aFilters.push(new Filter("Prctr", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE")))
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
						if(modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE")) {
							aFilters.push(new Filter("Prctr", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE")))
						} else {
							if(modelPosFin.getProperty("/DominioSStr/Amministrazione").length > 0) { //filtra per amministrazioni del dominio, se non è stata selezionata un'amministrazione
								aFilters.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Amministrazione"), "Prctr"))
							}
						}
						if(modelPosFin.getProperty("/infoSottoStrumento/DomMissione/results").length > 0)
							aFilters.push(this.__setMultiFiltersMissione(modelPosFin.getProperty("/infoSottoStrumento/DomMissione/results"), ["Missione"]))
						modelHana.read("/TipMissioneSet",{
							filters: aFilters,
							success: (oData) => {
								modelPosFin.setProperty("/formPosFin/missioni", function() {
									let aMissioni = []
										for(let i = 0; i <  oData.results.length; i++){
												if(aMissioni.filter(item => (item.Missione === oData.results[i].Missione)).length === 0)
													aMissioni.push(oData.results[i])
										}
									return aMissioni
								}())
								this.__setBusyHelp(modelPosFin, false)
							},
							error:  (err) => {
								this.__setBusyHelp(modelPosFin, false)
							}
						})
						break
					case "HVProgramma":
						//se si apre help value di Programma, controllare che sia stato valorizzata Missione e filtrare per tale valore
						if(modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE")) {
							aFilters.push(new Filter("Prctr", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE")))
						} else {
							if(modelPosFin.getProperty("/DominioSStr/Amministrazione").length > 0) { //filtra per amministrazioni del dominio, se non è stata selezionata un'amministrazione
								aFilters.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Amministrazione"), "Prctr"))
							}
						}
						if(modelPosFin.getProperty("/detailAnagrafica/MISSIONE")) {
							aFilters.push(new Filter("Missione", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/MISSIONE")))
						} else {
							if(modelPosFin.getProperty("/DominioSStr/Missione").length > 0) {
								aFilters.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Missione"), "Missione"))
							}
						}
						if(modelPosFin.getProperty("/DominioSStr/Programma").length > 0) {
							aFilters.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Programma"), "Programma"))
						}
						modelHana.read("/TipMissioneSet",{
							filters: aFilters,
							success: (oData) => {
								modelPosFin.setProperty("/formPosFin/programmi", function() {
									let aProgrammi = []
										for(let i = 0; i <  oData.results.length; i++){
											if(modelPosFin.getProperty("/DominioSStr/Programma").length > 0) {
												if(modelPosFin.getProperty("/DominioSStr/Programma").find(item => item.Missione === oData.results[i].Missione &&
																												item.Programma === oData.results[i].Programma))
													if(aProgrammi.filter(item => (item.Missione === oData.results[i].Missione &&
																				item.Programma === oData.results[i].Programma)).length === 0)
														aProgrammi.push(oData.results[i])
											} else {
												if(aProgrammi.filter(item => (item.Missione === oData.results[i].Missione &&
													item.Programma === oData.results[i].Programma)).length === 0)
														aProgrammi.push(oData.results[i])
											}
										}
									return aProgrammi
								}())
								this.__setBusyHelp(modelPosFin, false)
							},
							error:  (err) => {
								this.__setBusyHelp(modelPosFin, false)
							}
						})
					break
					case "HVAzione":
						//se si apre help value di Programma, controllare che sia stato valorizzata Missione e filtrare per tale valore
						if(modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE")) { // Filtro amministrazione se è stato già selezionato
							aFilters.push(new Filter("Prctr", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE")))
						} else {
							if(modelPosFin.getProperty("/DominioSStr/Amministrazione").length > 0) { //filtra per amministrazioni del dominio, se non è stata selezionata un'amministrazione
								aFilters.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Amministrazione"), "Prctr"))
							}
						}
						if(modelPosFin.getProperty("/detailAnagrafica/MISSIONE")) {
							aFilters.push(new Filter("Missione", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/MISSIONE")))
						} else {
							if(modelPosFin.getProperty("/DominioSStr/Missione").length > 0) {
								aFilters.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Missione"), "Missione"))
							}
						}
						if(modelPosFin.getProperty("/detailAnagrafica/PROGRAMMA")) {
							aFilters.push(new Filter("Programma", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/PROGRAMMA")))
						} else {
							if(modelPosFin.getProperty("/DominioSStr/Programma").length > 0) {
								aFilters.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Programma"), "Programma"))
							}
						}
						if(modelPosFin.getProperty("/DominioSStr/Azione").length > 0)
							aFilters.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Azione"), "Azione"))
						modelHana.read("/TipMissioneSet",{
							filters: aFilters,
							success: (oData) => {
								modelPosFin.setProperty("/formPosFin/azioni",function () {
									let aAzioni = []
										for(let i = 0; i <  oData.results.length; i++){
											if(modelPosFin.getProperty("/DominioSStr/Azione").length > 0) {
												if(modelPosFin.getProperty("/DominioSStr/Azione").find(item => item.Missione === oData.results[i].Missione &&
																												item.Programma === oData.results[i].Programma &&
																												item.Azione === oData.results[i].Azione &&
																												item.Prctr === oData.results[i].Prctr))
													aAzioni.push(oData.results[i])
											} else {
												aAzioni.push(oData.results[i])
											}
										}
									return aAzioni
								}())
								this.__setBusyHelp(modelPosFin, false)
							},
							error:  (err) => {
								this.__setBusyHelp(modelPosFin, false)
							}
						})
					break
					case "HVTitolo":
						aFilters.push(new Filter("Eos", FilterOperator.EQ, "S"))
						if(modelPosFin.getProperty("/infoSottoStrumento/DomTitolo/results").length > 0)
							aFilters.push(this.__setMultiFiltersMissione(modelPosFin.getProperty("/infoSottoStrumento/DomTitolo/results"), ["Titolo"]))
							modelHana.read("/TipTitoloSet",{
								filters: aFilters,
								success: (oData) => {
									oData.results = oData.results.filter( tit => !(tit.VersioneCategoria == "" || tit.VersioneCe2 == "" || tit.VersioneCe3 == "" || tit.VersioneTitolo == ""))
									modelPosFin.setProperty("/formPosFin/titoli", function() {
										let aTitoli = []
										for(let i = 0; i < oData.results.length; i++)
										if(modelPosFin.getProperty("/DominioSStr/Titolo").length > 0){
											if(modelPosFin.getProperty("/DominioSStr/Titolo").find(item => item.Titolo === oData.results[i].Titolo))
												if(aTitoli.filter(item => item.Titolo === oData.results[i].Titolo).length === 0 )
													aTitoli.push(oData.results[i])
										} else {
											if(aTitoli.filter(item => item.Titolo === oData.results[i].Titolo).length === 0 )
												aTitoli.push(oData.results[i])
										}
										return aTitoli
									}())
									this.__setBusyHelp(modelPosFin, false)
								},
								error:  (err) => {
									this.__setBusyHelp(modelPosFin, false)
								}
							})
						break
					case "HVCategoria":
						//se si apre help value di Categoria, controllare che sia stato valorizzata Titolo e filtrare per tale valore
						aFilters.push(new Filter("Eos", FilterOperator.EQ, "S"))
						if(modelPosFin.getProperty("/detailAnagrafica/TITOLO")) {
							aFilters.push(new Filter("Titolo", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/TITOLO")))
						} else {
							if(modelPosFin.getProperty("/DominioSStr/Titolo").length > 0)
								aFilters.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Titolo"), "Titolo"))
						}
						if(modelPosFin.getProperty("/DominioSStr/Categoria").length > 0){
							aFilters.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Categoria"), "Categoria"))
						}
						modelHana.read("/TipTitoloSet",{
							filters: aFilters,
							success: (oData) => {
								oData.results = oData.results.filter( tit => !(tit.VersioneCategoria == "" || tit.VersioneCe2 == "" || tit.VersioneCe3 == "" || tit.VersioneTitolo == ""))
								modelPosFin.setProperty("/formPosFin/categorie", function() {
									let aCategoria = []
									for(let i = 0; i < oData.results.length; i++)
										if(modelPosFin.getProperty("/DominioSStr/Categoria").length > 0){
											if(modelPosFin.getProperty("/DominioSStr/Categoria").find(item => item.Titolo === oData.results[i].Titolo && item.Categoria === oData.results[i].Categoria))
												if(aCategoria.filter(item => item.Titolo === oData.results[i].Titolo &&
																		item.Categoria === oData.results[i].Categoria).length === 0 )
													aCategoria.push(oData.results[i])
										} else {
											if(aCategoria.filter(item => item.Titolo === oData.results[i].Titolo &&
												item.Categoria === oData.results[i].Categoria).length === 0 )
												aCategoria.push(oData.results[i])
										}
									return aCategoria
								}())
								this.__setBusyHelp(modelPosFin, false)
							},
							error:  (err) => {
								this.__setBusyHelp(modelPosFin, false)
							}
						})
					break
					case "HVCe2":
						//se si apre help value di Categoria, controllare che sia stato valorizzata Titolo e filtrare per tale valore
						aFilters.push(new Filter("Eos", FilterOperator.EQ, "S"))
						if(modelPosFin.getProperty("/detailAnagrafica/TITOLO")) {
							aFilters.push(new Filter("Titolo", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/TITOLO")))
						} else {
							if(modelPosFin.getProperty("/DominioSStr/Titolo").length > 0)
								aFilters.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Titolo"), "Titolo"))
						}
						if(modelPosFin.getProperty("/detailAnagrafica/CATEGORIA")) {
							aFilters.push(new Filter("Categoria", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/CATEGORIA")))
						} else {
							if(modelPosFin.getProperty("/DominioSStr/Categoria").length > 0)
								aFilters.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Categoria"), "Categoria"))
						}
						if(modelPosFin.getProperty("/DominioSStr/Ce2").length > 0){
							aFilters.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Ce2"), "Ce2"))
						}
						modelHana.read("/TipTitoloSet",{
							filters: aFilters,
							success: (oData) => {
								oData.results = oData.results.filter( tit => !(tit.VersioneCategoria == "" || tit.VersioneCe2 == "" || tit.VersioneCe3 == "" || tit.VersioneTitolo == ""))
								modelPosFin.setProperty("/formPosFin/ce2", function() {
									let aCe2 = []
									for(let i = 0; i < oData.results.length; i++)
										if(modelPosFin.getProperty("/DominioSStr/Ce2").length > 0) {
											if(modelPosFin.getProperty("/DominioSStr/Ce2").find(item => item.Titolo === oData.results[i].Titolo &&
																											  item.Categoria === oData.results[i].Categoria &&
																											  item.Ce2 === oData.results[i].Ce2))
												if(aCe2.filter(item => item.Titolo === oData.results[i].Titolo &&
																			item.Categoria === oData.results[i].Categoria &&
																			item.Ce2 === oData.results[i].Ce2).length === 0 )
													aCe2.push(oData.results[i])
										} else {
											if(aCe2.filter(item => item.Titolo === oData.results[i].Titolo &&
												item.Categoria === oData.results[i].Categoria &&
												item.Ce2 === oData.results[i].Ce2).length === 0 )
												aCe2.push(oData.results[i])
										}
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
						//se si apre help value di Categoria, controllare che sia stato valorizzata Titolo e filtrare per tale valore
						aFilters.push(new Filter("Eos", FilterOperator.EQ, "S"))
						if(modelPosFin.getProperty("/detailAnagrafica/TITOLO")) {
							aFilters.push(new Filter("Titolo", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/TITOLO")))
						} else {
							if(modelPosFin.getProperty("/DominioSStr/Titolo").length > 0)
								aFilters.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Titolo"), "Titolo"))
						}
						if(modelPosFin.getProperty("/detailAnagrafica/CATEGORIA")) {
							aFilters.push(new Filter("Categoria", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/CATEGORIA")))
						} else {
							if(modelPosFin.getProperty("/DominioSStr/Categoria").length > 0)
								aFilters.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Categoria"), "Categoria"))
						}
						if(modelPosFin.getProperty("/detailAnagrafica/CE2")) {
							aFilters.push(new Filter("Ce2", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/CE2")))
						} else {
							if(modelPosFin.getProperty("/DominioSStr/Ce2").length > 0)
								aFilters.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Ce2"), "Ce2"))
						}
						if(modelPosFin.getProperty("/DominioSStr/Ce3").length > 0)
							aFilters.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Ce3"), "Ce3"))

							modelHana.read("/TipTitoloSet",{
								filters: aFilters,
								success: (oData) => {
									oData.results = oData.results.filter( tit => !(tit.VersioneCategoria == "" || tit.VersioneCe2 == "" || tit.VersioneCe3 == "" || tit.VersioneTitolo == ""))
									modelPosFin.setProperty("/formPosFin/ce3", function() {
										let aCe3 = []
										for(let i = 0; i < oData.results.length; i++)
											if(modelPosFin.getProperty("/DominioSStr/Ce3").length > 0) {
												if(modelPosFin.getProperty("/DominioSStr/Ce3").find(item => item.Titolo === oData.results[i].Titolo &&
																												  item.Categoria === oData.results[i].Categoria &&
																												  item.Ce2 === oData.results[i].Ce2  &&
																												  item.Ce3 === oData.results[i].Ce3))
													if(aCe3.filter(item => item.Titolo === oData.results[i].Titolo &&
																				item.Categoria === oData.results[i].Categoria &&
																				item.Ce2 === oData.results[i].Ce2 && item.Ce3 === oData.results[i].Ce3).length === 0 )
														aCe3.push(oData.results[i])
											} else {
												if(aCe3.filter(item => item.Titolo === oData.results[i].Titolo &&
													item.Categoria === oData.results[i].Categoria &&
													item.Ce2 === oData.results[i].Ce2 && item.Ce3 === oData.results[i].Ce3).length === 0 )
													aCe3.push(oData.results[i])
											}
										return aCe3
									}())
									this.__setBusyHelp(modelPosFin, false)
								},
								error:  (err) => {
									this.__setBusyHelp(modelPosFin, false)
								}
							})
					break
				default:
					break;
			}
		},
		__getDataHVPosFin: function () {
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getView().getModel("modelPosFin")
			let filtersAmm = [new Filter("Fikrs", FilterOperator.EQ, "S001"),
									  new Filter("Fase", FilterOperator.EQ, "NV"),
									  new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
									  new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale"))
									]
			let filtersTitolo = [...filtersAmm]
			let filtersMissione = [...filtersAmm]
			let filtersRagioneria = [...filtersAmm]
			let filterTipoFondo = [...filtersAmm]
			let filterCodiceStandard = [...filtersAmm]
			//Estrazione Amm, Capitolo, Pg, Azione, Cdr, Programma e Missione
			if(modelPosFin.getProperty("/DominioSStr/Amministrazione").length > 0) {
				filtersAmm.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Amministrazione"), "Prctr"))
			}
			modelHana.read("/TipAmministrazioneSet",{
				filters: filtersAmm,
				urlParameters: {
					$expand: "TipMissione,TipCapitolo,TipCdr"
				},
				success: (oData) => {
					//debugger
					modelPosFin.setProperty("/formPosFin/amministrazioni", oData.results)
					if(modelPosFin.getProperty("/infoSottoStrumento/DomAmministrazione/results").length === 1){
						modelPosFin.setProperty("/detailAnagrafica/AMMINISTAZIONE", oData.results[0].Prctr)
						modelPosFin.setProperty("/detailAnagrafica/DESC_AMMINISTAZIONE", oData.results[0].DescEstesa)
					}
					modelPosFin.setProperty("/formPosFin/capitoli", function() {
						let aCapitoli = []
						if(oData.results.length === 1) {
							for(let i = 0; i <  oData.results.length; i++){
								for(let j = 0; j < oData.results[i].TipCapitolo.results.length; j++)
									if(aCapitoli.filter(item => (item.Prctr === oData.results[i].TipCapitolo.results[j].Prctr && item.Capitolo === oData.results[i].TipCapitolo.results[j].Capitolo)).length === 0)
										aCapitoli.push(oData.results[i].TipCapitolo.results[j])
							}
						} else {
							for(let i = 0; i < oData.results.length; i++){
								for(let j = 0; j < oData.results[i].TipCapitolo.results.length; j++)
									if(aCapitoli.filter(item => (item.Prctr === oData.results[i].TipCapitolo.results[j].Prctr && item.Capitolo === oData.results[i].TipCapitolo.results[j].Capitolo)).length === 0)
										aCapitoli.push(oData.results[i].TipCapitolo.results[j])
							}
						}
						return aCapitoli
					}())
					modelPosFin.setProperty("/formPosFin/pg", function() {
						let aPg = []
						if(oData.results.length === 1) {
							for(let i = 0; i <  oData.results.length; i++){
								aPg.push(...oData.results[i].TipCapitolo.results)
							}
						} else {
							for(let i = 0; i < oData.results.length; i++){
								aPg.push(...oData.results[i].TipCapitolo.results)
							}
						}
						return aPg
					}())
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
				},
				error:  (err) => {
					//debugger
				}
			})
			//Fine estrazione Amm, Capitolo, Pg, Cdr,

			//Inizio Estrazione Missioni, Programmi e Azioni
			if(modelPosFin.getProperty("/DominioSStr/Missione").length > 0) {
				filtersMissione.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Missione"), "Missione"))
				filtersMissione.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Programma"), "Programma"))
				filtersMissione.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Azione"), "Azione"))
			}
			if(modelPosFin.getProperty("/DominioSStr/Amministrazione"))
				filtersMissione.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Amministrazione"), "Prctr"))
			
			modelHana.read("/TipMissioneSet",{
				filters: filtersMissione,
				success:  (oData) => {
					modelPosFin.setProperty("/formPosFin/missioni", function() {
						let aMissioni = []
							for(let i = 0; i <  oData.results.length; i++){
									if(aMissioni.filter(item => (item.Missione === oData.results[i].Missione)).length === 0)
										aMissioni.push(oData.results[i])
							}
						return aMissioni
					}())
					modelPosFin.setProperty("/formPosFin/programmi", function() {
						let aProgrammi = []
							for(let i = 0; i <  oData.results.length; i++){
								if(modelPosFin.getProperty("/DominioSStr/Programma").length > 0) {
									if(modelPosFin.getProperty("/DominioSStr/Programma").find(item => item.Missione === oData.results[i].Missione &&
																									item.Programma === oData.results[i].Programma))
										if(aProgrammi.filter(item => (item.Missione === oData.results[i].Missione &&
																	item.Programma === oData.results[i].Programma)).length === 0)
											aProgrammi.push(oData.results[i])
								} else {
									if(aProgrammi.filter(item => (item.Missione === oData.results[i].Missione &&
										item.Programma === oData.results[i].Programma)).length === 0)
											aProgrammi.push(oData.results[i])
								}
							}
						return aProgrammi
					}())
					modelPosFin.setProperty("/formPosFin/azioni", function () {
						let aAzioni = []
							for(let i = 0; i <  oData.results.length; i++){
								if(modelPosFin.getProperty("/DominioSStr/Azione").length > 0) {
									if(modelPosFin.getProperty("/DominioSStr/Azione").find(item => item.Missione === oData.results[i].Missione &&
																									item.Programma === oData.results[i].Programma &&
																									item.Azione === oData.results[i].Azione &&
																									item.Prctr === oData.results[i].Prctr))
										aAzioni.push(oData.results[i])
								} else {
									aAzioni.push(oData.results[i])
								}
							}
						return aAzioni
					}())
				},
				error: function (err) {
					//debugger
				}
			})
			//Fine Estrazione Missioni, Programmi e Azioni

			//Inizio Estrazione Titolo, Categoria, Ce2 e Ce3
			if(modelPosFin.getProperty("/infoSottoStrumento/DomTitolo/results").length > 0) {
				//creazione Filtri Titolo, Categoria, Ce2 e Ce3 nel caso sstr abbia dominio
				filtersTitolo.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Titolo"), "Titolo"))
				filtersTitolo.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Categoria"), "Categoria"))
				filtersTitolo.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Ce2"), "Ce2"))
				filtersTitolo.push(this.__getFiltersOR(modelPosFin.getProperty("/DominioSStr/Ce3"), "Ce3"))
			}
			modelHana.read("/TipTitoloSet",{
				filters: filtersTitolo,
				success: (oData, res) => {
					modelPosFin.setProperty("/formPosFin/titoli", function() {
						let aTitoli = []
						for(let i = 0; i < oData.results.length; i++)
						  if(modelPosFin.getProperty("/DominioSStr/Titolo").length > 0){
							if(modelPosFin.getProperty("/DominioSStr/Titolo").find(item => item.Titolo === oData.results[i].Titolo))
								if(aTitoli.filter(item => item.Titolo === oData.results[i].Titolo).length === 0 )
									aTitoli.push(oData.results[i])
						  } else {
							if(aTitoli.filter(item => item.Titolo === oData.results[i].Titolo).length === 0 )
								aTitoli.push(oData.results[i])
						  }
						return aTitoli
					}())
					modelPosFin.setProperty("/formPosFin/categorie", function() {
						let aCategoria = []
						for(let i = 0; i < oData.results.length; i++)
							if(modelPosFin.getProperty("/DominioSStr/Categoria").length > 0){
								if(modelPosFin.getProperty("/DominioSStr/Categoria").find(item => item.Titolo === oData.results[i].Titolo && item.Categoria === oData.results[i].Categoria))
									if(aCategoria.filter(item => item.Titolo === oData.results[i].Titolo &&
															item.Categoria === oData.results[i].Categoria).length === 0 )
										aCategoria.push(oData.results[i])
							} else {
								if(aCategoria.filter(item => item.Titolo === oData.results[i].Titolo &&
									item.Categoria === oData.results[i].Categoria).length === 0 )
									aCategoria.push(oData.results[i])
							}
						return aCategoria
					}())
					modelPosFin.setProperty("/formPosFin/ce2", function() {
						let aCe2 = []
						for(let i = 0; i < oData.results.length; i++)
						    if(modelPosFin.getProperty("/DominioSStr/Ce2").length > 0) {
								if(modelPosFin.getProperty("/DominioSStr/Ce2").find(item => item.Titolo === oData.results[i].Titolo &&
																								  item.Categoria === oData.results[i].Categoria &&
																								  item.Ce2 === oData.results[i].Ce2))
									if(aCe2.filter(item => item.Titolo === oData.results[i].Titolo &&
																item.Categoria === oData.results[i].Categoria &&
																item.Ce2 === oData.results[i].Ce2).length === 0 )
										aCe2.push(oData.results[i])
							} else {
								if(aCe2.filter(item => item.Titolo === oData.results[i].Titolo &&
									item.Categoria === oData.results[i].Categoria &&
									item.Ce2 === oData.results[i].Ce2).length === 0 )
									aCe2.push(oData.results[i])
							}
						return aCe2
					}())
					modelPosFin.setProperty("/formPosFin/ce3", function() {
						let aCe3 = []
						for(let i = 0; i < oData.results.length; i++)
						    if(modelPosFin.getProperty("/DominioSStr/Ce3").length > 0) {
								if(modelPosFin.getProperty("/DominioSStr/Ce3").find(item => item.Titolo === oData.results[i].Titolo &&
																								  item.Categoria === oData.results[i].Categoria &&
																								  item.Ce2 === oData.results[i].Ce2  &&
																								  item.Ce3 === oData.results[i].Ce3))
									if(aCe3.filter(item => item.Titolo === oData.results[i].Titolo &&
																item.Categoria === oData.results[i].Categoria &&
																item.Ce2 === oData.results[i].Ce2 && item.Ce3 === oData.results[i].Ce3).length === 0 )
										aCe3.push(oData.results[i])
							} else {
								if(aCe3.filter(item => item.Titolo === oData.results[i].Titolo &&
									item.Categoria === oData.results[i].Categoria &&
									item.Ce2 === oData.results[i].Ce2 && item.Ce3 === oData.results[i].Ce3).length === 0 )
									aCe3.push(oData.results[i])
							}
						return aCe3
					}())
				}
			})
			//Fine estrazione Titolo, Categoria, Ce2 e Ce3

			//Inizio Estrazione Ragioneria
			modelHana.read("/TipRagioneriaSet", {
				filters: filtersRagioneria,
				success: (oData) => {
					modelPosFin.setProperty("/formPosFin/ragionerie", oData.results)
				}
			})
			//Fine Estrazione Ragioneria

			//Inizio Estrazione Mac
			modelHana.read("/MacSet", {
				success: (oData) => {
					modelPosFin.setProperty("/formPosFin/mac", oData.results)
				}
			})
			//Fine Estrazione Mac

			//Inizio Estrazione Tipo Fondo
			modelHana.read("/TipoFondoSet", {
				filters: filterTipoFondo,
				success: (oData) => {
					oData.results.unshift({CodiceTipoFondo: null, DescTipoFondo: null})
					modelPosFin.setProperty("/formPosFin/tipofondo", oData.results)
				}
			})
			//Fine Estrazione Tipo Fondo

			//Inizio Estrazione Codici Standard
			modelHana.read("/CodiceStandardSet", {
				filters: filterCodiceStandard,
				success: (oData) => {
					modelPosFin.setProperty("/formPosFin/codiceStandard", oData.results)
				}
			})
			//Fine Estrazione Codici Standard
		},
		__getFiltersOR: function (aData, field) {
			return new Filter({
				filters: function () {
					let aFilters = []
					for(let i =0 ; i < aData.length; i++){
						aFilters.push(new Filter(field, FilterOperator.EQ, aData[i][field]))
					}
					return aFilters
				}(),
				and: false,
			  })	
		},
		getAmmDescEstesa: function (Prctr) {
			let modelPosFin = this.getView().getModel("modelPosFin")
			let aAmministrazioni = modelPosFin.getProperty("/formPosFin/amministrazioni")
			return aAmministrazioni.filter(amm => amm.Prctr === Prctr)[0].DescEstesa
		},
		onCloseHVPosFin: function (oEvent) {
			oEvent.getSource().getParent().close()
		},
		onConfirmSelectionPosFin: function (oEvent, value) {
			//let {_, value} = oEvent.getSource().getCustomData()[0].mProperties
			let modelPosFin = this.getView().getModel("modelPosFin")
			let sPath, aAmministrazioni;
			if(value==="null"){
				var aDataInfo = this.getView().getModel("modelInfo").getData().CodiceSelected;
				value = aDataInfo;
			}
			switch (value) {
				case "Amministrazione":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths()
					//check se sono stati selezionati figli; in caso di amministrazione non combaciante, resettare input
					if(modelPosFin.getProperty(sPath + "/Prctr") !== modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE")) {
						modelPosFin.setProperty("/detailAnagrafica/CAPITOLO", null)
						modelPosFin.setProperty("/detailAnagrafica/pg", null)
						modelPosFin.setProperty("/detailAnagrafica/CDR", null)
						modelPosFin.setProperty("/detailAnagrafica/CDR_DESCR", null)
					}
					modelPosFin.setProperty("/detailAnagrafica/AMMINISTAZIONE", modelPosFin.getProperty(sPath + "/Prctr"))
					modelPosFin.setProperty("/detailAnagrafica/DESC_AMMINISTAZIONE", modelPosFin.getProperty(sPath + "/DescEstesa"))

					break;
				case "Capitolo":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths()
					//check se sono stati selezionati figli; in caso di capitolo non combaciante, resettare input
					if(modelPosFin.getProperty(sPath[0] + "/Capitolo") !== modelPosFin.getProperty("/detailAnagrafica/CAPITOLO")) {
						modelPosFin.setProperty("/detailAnagrafica/pg", null)
					}
					aAmministrazioni = modelPosFin.getProperty("/formPosFin/amministrazioni")
					let oCapitolo = modelPosFin.getProperty(sPath[0])
					modelPosFin.setProperty("/detailAnagrafica/CAPITOLO", modelPosFin.getProperty(sPath[0] + "/Capitolo"))
					modelPosFin.setProperty("/detailAnagrafica/DESC_CAPITOLO", modelPosFin.getProperty(sPath[0] + "/DescEstesaCapitolo"))
					modelPosFin.setProperty("/detailAnagrafica/VersioneCapitolo", modelPosFin.getProperty(sPath[0] + "/VersioneCapitolo"))
					modelPosFin.setProperty("/detailAnagrafica/AMMINISTAZIONE", aAmministrazioni.filter(amm => amm.Prctr === oCapitolo.Prctr)[0].Prctr)
					modelPosFin.setProperty("/detailAnagrafica/DESC_AMMINISTAZIONE",aAmministrazioni.filter(amm => amm.Prctr === oCapitolo.Prctr)[0].DescEstesa)

					// const oPrctrCap = {
					// 	Capitolo: modelPosFin.getProperty("/detailAnagrafica/CAPITOLO"), 
					// 	Prctr: modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE")
					// }
					//this.__setElenchi(oPrctrCap)
					//this.__setCofog(oPrctrCap)
					this.__resetAttributiCapitolo() //reset Attributi tranne Amministrazione e Capitolo

					//Estrazione Codice Standard del Capitolo
					if(oCapitolo.CodiceStdCapitolo !== "000") {
						this.__setCodeStandard(oCapitolo, "CodiceStdCapitolo", "CODICE_STANDARD_CAPITOLO", "CD_CAPITOLO_DEN_EST", "CD_CAPITOLO_DEN_BREVE") //Codice Std Capitolo da Anagrafica Codici Std
					} else {
						modelPosFin.setProperty("/detailAnagrafica/CODICE_STANDARD_CAPITOLO", null)
						modelPosFin.setProperty("/detailAnagrafica/CD_CAPITOLO_DEN_EST", oCapitolo.DescEstesaCapitolo)
						modelPosFin.setProperty("/detailAnagrafica/CD_CAPITOLO_DEN_BREVE", oCapitolo.DescBreveCapitolo)	
						modelPosFin.updateBindings(true)
					} 

					//this.__setFieldPosizioneFinanziariaIrap(oPrctrCap)
					this.getDataKeyPosFin()
					break
				case "Pg":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths()
					aAmministrazioni = modelPosFin.getProperty("/formPosFin/amministrazioni")
					let oPg = modelPosFin.getProperty(sPath[0])
					modelPosFin.setProperty("/detailAnagrafica/pg", modelPosFin.getProperty(sPath[0] + "/Pg"))
					modelPosFin.setProperty("/detailAnagrafica/CAPITOLO", modelPosFin.getProperty(sPath[0] + "/Capitolo"))
					modelPosFin.setProperty("/detailAnagrafica/AMMINISTAZIONE", aAmministrazioni.filter(amm => amm.Prctr === oPg.Prctr)[0].Prctr)
					modelPosFin.setProperty("/detailAnagrafica/DESC_AMMINISTAZIONE",aAmministrazioni.filter(amm => amm.Prctr === oPg.Prctr)[0].DescEstesa)
					break
				case "Cdr":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths()
					aAmministrazioni = modelPosFin.getProperty("/formPosFin/amministrazioni")
					let oCdr = modelPosFin.getProperty(sPath[0])
					modelPosFin.setProperty("/detailAnagrafica/CDR", modelPosFin.getProperty(sPath[0] + "/Cdr"))
					modelPosFin.setProperty("/detailAnagrafica/CDR_DESCR", modelPosFin.getProperty(sPath[0] + "/DescEstesaCdr"))
					modelPosFin.setProperty("/detailAnagrafica/AMMINISTAZIONE", aAmministrazioni.filter(amm => amm.Prctr === oCdr.Prctr)[0].Prctr)
					modelPosFin.setProperty("/detailAnagrafica/DESC_AMMINISTAZIONE",aAmministrazioni.filter(amm => amm.Prctr === oCdr.Prctr)[0].DescEstesa)
					break
				case "Missione":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths()
					//check se sono stati selezionati figli; in caso di Missione non combaciante, resettare input
					if(modelPosFin.getProperty(sPath + "/Missione") !== modelPosFin.getProperty("/detailAnagrafica/MISSIONE")) {
						modelPosFin.setProperty("/detailAnagrafica/PROGRAMMA", null)
						modelPosFin.setProperty("/detailAnagrafica/DESC_PROGRAMMA",null)
						modelPosFin.setProperty("/detailAnagrafica/AZIONE", null)
						modelPosFin.setProperty("/detailAnagrafica/DESC_AZIONE",null)
						modelPosFin.setProperty("/detailAnagrafica/CDR", null)
						modelPosFin.setProperty("/detailAnagrafica/CDR_DESCR",null)
					}
					modelPosFin.setProperty("/detailAnagrafica/MISSIONE", modelPosFin.getProperty(sPath + "/Missione"))
					modelPosFin.setProperty("/detailAnagrafica/DESC_MISSIONE", modelPosFin.getProperty(sPath + "/DescEstesaMissione"))

					break;
				case "Programma":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths()
					//check se sono stati selezionati figli; in caso di amministrazione non combaciante, resettare input
					if(modelPosFin.getProperty(sPath + "/Programma") !== modelPosFin.getProperty("/detailAnagrafica/PROGRAMMA")) {
						modelPosFin.setProperty("/detailAnagrafica/AZIONE", null)
						modelPosFin.setProperty("/detailAnagrafica/DESC_AZIONE",null)
						modelPosFin.setProperty("/detailAnagrafica/CDR", null)
						modelPosFin.setProperty("/detailAnagrafica/CDR_DESCR",null)
					}
					modelPosFin.setProperty("/detailAnagrafica/MISSIONE", modelPosFin.getProperty(sPath[0] + "/Missione"))
					modelPosFin.setProperty("/detailAnagrafica/DESC_MISSIONE", modelPosFin.getProperty(sPath[0] + "/DescEstesaMissione"))
					modelPosFin.setProperty("/detailAnagrafica/PROGRAMMA", modelPosFin.getProperty(sPath[0] + "/Programma"))
					modelPosFin.setProperty("/detailAnagrafica/DESC_PROGRAMMA", modelPosFin.getProperty(sPath[0] + "/DescEstesaProgramma"))
					if(modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE"))
						this.__setUdv({
							Prctr: modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE"),
							Programma: modelPosFin.getProperty("/detailAnagrafica/PROGRAMMA"),
							Missione: modelPosFin.getProperty("/detailAnagrafica/MISSIONE")
						})
					this._setCdr({
						Prctr: modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE"),
						Programma: modelPosFin.getProperty("/detailAnagrafica/PROGRAMMA"),
						Missione: modelPosFin.getProperty("/detailAnagrafica/MISSIONE")
					})
					break;
				case "Azione":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths()
					modelPosFin.setProperty("/detailAnagrafica/AMMINISTAZIONE", modelPosFin.getProperty(sPath[0] + "/Prctr"))
					modelPosFin.setProperty("/detailAnagrafica/DESC_AMMINISTAZIONE",modelPosFin.getProperty(sPath[0] + "/DescEstesaPrctr"))
					modelPosFin.setProperty("/detailAnagrafica/MISSIONE", modelPosFin.getProperty(sPath[0] + "/Missione"))
					modelPosFin.setProperty("/detailAnagrafica/DESC_MISSIONE", modelPosFin.getProperty(sPath[0] + "/DescEstesaMissione"))
					modelPosFin.setProperty("/detailAnagrafica/PROGRAMMA", modelPosFin.getProperty(sPath[0] + "/Programma"))
					modelPosFin.setProperty("/detailAnagrafica/DESC_PROGRAMMA", modelPosFin.getProperty(sPath[0] + "/DescEstesaProgramma"))
					modelPosFin.setProperty("/detailAnagrafica/AZIONE", modelPosFin.getProperty(sPath[0] + "/Azione"))
					modelPosFin.setProperty("/detailAnagrafica/DESC_AZIONE", modelPosFin.getProperty(sPath[0] + "/DescEstesaAzione"))
					this.__setUdv({
						Prctr: modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE"),
						Programma: modelPosFin.getProperty("/detailAnagrafica/PROGRAMMA"),
						Missione: modelPosFin.getProperty("/detailAnagrafica/MISSIONE")
					})
					this._setCdr({
						Prctr: modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE"),
						Programma: modelPosFin.getProperty("/detailAnagrafica/PROGRAMMA"),
						Missione: modelPosFin.getProperty("/detailAnagrafica/MISSIONE")
					})
					break;
				case "Titolo":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths()
					//check se sono stati selezionati figli; in caso di Missione non combaciante, resettare input
					if(modelPosFin.getProperty(sPath + "/Titolo") !== modelPosFin.getProperty("/detailAnagrafica/TITOLO")) {
						modelPosFin.setProperty("/detailAnagrafica/CATEGORIA", null)
						modelPosFin.setProperty("/detailAnagrafica/DESC_CATEGORIA",null)
						modelPosFin.setProperty("/detailAnagrafica/CE2", null)
						modelPosFin.setProperty("/detailAnagrafica/DESC_CE2",null)
						modelPosFin.setProperty("/detailAnagrafica/CE3", null)
						modelPosFin.setProperty("/detailAnagrafica/DESC_CE3",null)
					}
					modelPosFin.setProperty("/detailAnagrafica/TITOLO", modelPosFin.getProperty(sPath + "/Titolo"))
					modelPosFin.setProperty("/detailAnagrafica/DESC_TITOLO", modelPosFin.getProperty(sPath + "/DescEstesaTitolo"))

					break;
				case "Categoria":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths()
					//check se sono stati selezionati figli; in caso di Missione non combaciante, resettare input
					if(modelPosFin.getProperty(sPath[0] + "/Categoria") !== modelPosFin.getProperty("/detailAnagrafica/CATEGORIA")) {
						modelPosFin.setProperty("/detailAnagrafica/CE2", null)
						modelPosFin.setProperty("/detailAnagrafica/DESC_CE2",null)
						modelPosFin.setProperty("/detailAnagrafica/CE3", null)
						modelPosFin.setProperty("/detailAnagrafica/DESC_CE3",null)
					}
					modelPosFin.setProperty("/detailAnagrafica/TITOLO", modelPosFin.getProperty(sPath[0] + "/Titolo"))
					modelPosFin.setProperty("/detailAnagrafica/DESC_TITOLO", modelPosFin.getProperty(sPath[0]  + "/DescEstesaTitolo"))
					modelPosFin.setProperty("/detailAnagrafica/CATEGORIA", modelPosFin.getProperty(sPath[0]  + "/Categoria"))
					modelPosFin.setProperty("/detailAnagrafica/DESC_CATEGORIA", modelPosFin.getProperty(sPath[0] + "/DescEstesaCategoria"))

					break;
				case "Ce2":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths()
					//check se sono stati selezionati figli; in caso di Missione non combaciante, resettare input
					if(modelPosFin.getProperty(sPath[0] + "/Ce2") !== modelPosFin.getProperty("/detailAnagrafica/CE2")) {
						modelPosFin.setProperty("/detailAnagrafica/CE3", null)
						modelPosFin.setProperty("/detailAnagrafica/DESC_CE3",null)
					}
					modelPosFin.setProperty("/detailAnagrafica/TITOLO", modelPosFin.getProperty(sPath[0] + "/Titolo"))
					modelPosFin.setProperty("/detailAnagrafica/DESC_TITOLO", modelPosFin.getProperty(sPath[0]  + "/DescEstesaTitolo"))
					modelPosFin.setProperty("/detailAnagrafica/CATEGORIA", modelPosFin.getProperty(sPath[0]  + "/Categoria"))
					modelPosFin.setProperty("/detailAnagrafica/DESC_CATEGORIA", modelPosFin.getProperty(sPath[0] + "/DescEstesaCategoria"))
					modelPosFin.setProperty("/detailAnagrafica/CE2", modelPosFin.getProperty(sPath[0]  + "/Ce2"))
					modelPosFin.setProperty("/detailAnagrafica/DESC_CE2", modelPosFin.getProperty(sPath[0] + "/DescEstesaCe2"))

					break;
				case "Ce3":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths()
					modelPosFin.setProperty("/detailAnagrafica/TITOLO", modelPosFin.getProperty(sPath[0] + "/Titolo"))
					modelPosFin.setProperty("/detailAnagrafica/DESC_TITOLO", modelPosFin.getProperty(sPath[0]  + "/DescEstesaTitolo"))
					modelPosFin.setProperty("/detailAnagrafica/CATEGORIA", modelPosFin.getProperty(sPath[0]  + "/Categoria"))
					modelPosFin.setProperty("/detailAnagrafica/DESC_CATEGORIA", modelPosFin.getProperty(sPath[0] + "/DescEstesaCategoria"))
					modelPosFin.setProperty("/detailAnagrafica/CE2", modelPosFin.getProperty(sPath[0]  + "/Ce2"))
					modelPosFin.setProperty("/detailAnagrafica/DESC_CE2", modelPosFin.getProperty(sPath[0] + "/DescEstesaCe2"))
					modelPosFin.setProperty("/detailAnagrafica/CE3", modelPosFin.getProperty(sPath[0]  + "/Ce3"))
					modelPosFin.setProperty("/detailAnagrafica/DESC_CE3", modelPosFin.getProperty(sPath[0] + "/DescEstesaCe3"))

					break;
				case "Ragioneria":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths()
					modelPosFin.setProperty("/detailAnagrafica/DESC_RAG", modelPosFin.getProperty(sPath[0]  + "/DescrEstesaRagioneria"))
					modelPosFin.setProperty("/detailAnagrafica/RAG", modelPosFin.getProperty(sPath[0]  + "/Ragioneria"))
					modelPosFin.setProperty("/detailAnagrafica/AMMINISTAZIONE", modelPosFin.getProperty(sPath[0]  + "/Prctr"))
					modelPosFin.setProperty("/detailAnagrafica/DESC_AMMINISTAZIONE", modelPosFin.getProperty(sPath[0]  + "/DescrEstesaAmmin"))
					break;
				case "Mac":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths()
					modelPosFin.setProperty("/detailAnagrafica/DESC_MAC", modelPosFin.getProperty(sPath  + "/DescEstesa"))
					modelPosFin.setProperty("/detailAnagrafica/MAC", modelPosFin.getProperty(sPath  + "/NumeCodDett"))
					break;
				case "CodiceStandardCapitolo":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths()
					modelPosFin.setProperty("/detailAnagrafica/CODICE_STANDARD_CAPITOLO", modelPosFin.getProperty(sPath[0]  + "/CodiceStd"))
					modelPosFin.setProperty("/detailAnagrafica/CD_CAPITOLO_DEN_EST", modelPosFin.getProperty(sPath[0]  + "/DescEstesa"))
					modelPosFin.setProperty("/detailAnagrafica/CD_CAPITOLO_DEN_BREVE", modelPosFin.getProperty(sPath[0]  + "/DescBreve"))
					modelPosFin.setProperty("/gestioneCampiEditabili/den_breve_capitolo", false)
					modelPosFin.setProperty("/gestioneCampiEditabili/den_estesa_capitolo", false)
					modelPosFin.updateBindings(true)
					break;
				case "CodiceStandardPG":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths()
					modelPosFin.setProperty("/detailAnagrafica/CODICE_STANDARD_PG", modelPosFin.getProperty(sPath[0]  + "/CodiceStd"))
					modelPosFin.setProperty("/detailAnagrafica/CD_PG_DEN_EST", modelPosFin.getProperty(sPath[0]  + "/DescEstesa"))
					modelPosFin.setProperty("/detailAnagrafica/CD_PG_DEN_BREVE", modelPosFin.getProperty(sPath[0]  + "/DescBreve"))
					modelPosFin.setProperty("/gestioneCampiEditabili/den_breve_pg", false)
					modelPosFin.setProperty("/gestioneCampiEditabili/den_estesa_pg", false)
					modelPosFin.updateBindings(true)
					break;
				case "Cofog":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths()
					modelPosFin.setProperty("/add_lv1_cofog", modelPosFin.getProperty(sPath[0]  + "/CofogL1"))
					modelPosFin.setProperty("/add_lv2_cofog", modelPosFin.getProperty(sPath[0]  + "/CofogL2"))
					modelPosFin.setProperty("/add_lv3_cofog", modelPosFin.getProperty(sPath[0]  + "/CofogL3"))
					modelPosFin.setProperty("/add_desc_cofog", modelPosFin.getProperty(sPath[0]  + "/Desc"))
					break;
				case "CodiceElenco":
					sPath = oEvent.getSource().getParent().getContent()[0].getSelectedContextPaths()
					modelPosFin.setProperty("/codiceElenco", modelPosFin.getProperty(sPath  + "/NumeroElenco"))
					modelPosFin.setProperty("/descElenco", modelPosFin.getProperty(sPath  + "/DescEstesa"))
					break;
				default:
					break;
			}
			this.resetDialogSearchField(oEvent.getSource());
			oEvent.getSource().getParent().close()
		},
		_setCdr: function (params) {
			const formatDate = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "yyyyMMdd" })
			const modelPosFin = this.getView().getModel("modelPosFin")
			const modelFoglioNotizie = this.getOwnerComponent().getModel("sapHanaS2FoglioNotizie")
			const oPosFin = modelPosFin.getProperty("/PosFin")
			let aFilters = [
				new Filter("ANNO", FilterOperator.EQ, oPosFin.Anno),
				new Filter("LOEKZ", FilterOperator.EQ, ''),
				new Filter("FIKRS", FilterOperator.EQ, oPosFin.Fikrs),
				new Filter("FASE", FilterOperator.EQ, oPosFin.Fase),
				new Filter("REALE", FilterOperator.EQ, oPosFin.Reale),
				new Filter("DATBIS", FilterOperator.GE, formatDate.format(new Date())),
				new Filter("PRCTR", FilterOperator.EQ, params.Prctr),
				new Filter("CODICE_MISSIONE", FilterOperator.EQ, params.Missione),
				new Filter("CODICE_PROGRAMMA", FilterOperator.EQ, params.Programma)
			]
			modelFoglioNotizie.read("/ZES_MC_CDR_SET", {
				filters: aFilters,
				success: (oData) => {
					modelPosFin.setProperty("/detailAnagrafica/CDR", oData.results.length > 0 ? oData.results[0].CODICE_CDR : null)
					modelPosFin.setProperty("/detailAnagrafica/CDR_DESCR", oData.results.length > 0 ? oData.results[0].DESCR_ESTESA : null)
				},
				error: (err) => {
				}
			})
		},
		getDataKeyPosFin: function () {
			this.getView().setBusy(true)
			const modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getView().getModel("modelPosFin")
			return new Promise((resolve, reject) => {
				modelHana.read("/PosizioneFinanziariaSet", {
					filters: [new Filter("Fikrs", FilterOperator.EQ, "S001"),
								new Filter("Fase", FilterOperator.EQ, "NV"),
								new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
								new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
								new Filter("Datbis", FilterOperator.GE, new Date()),
								new Filter("Eos", FilterOperator.EQ, "S"),
								new Filter("Capitolo", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/CAPITOLO")),
								new Filter("Prctr", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE"))
							],
					success: (oData) => {
						if(oData.results.length > 0) {
							if(oData.results.find(item => item.Versione === "P")){
								oData.results = oData.results.filter(item => item.Versione === "P")
							}
								return new Promise( (resolve, reject) => {
									Promise.all([this.__setFieldTitolo(oData.results[0]), this.__setFieldMissione(oData.results[0]), this.__setFieldCdr(oData.results[0]),
												this.__setFieldRagioneria(oData.results[0]), this.__setFieldMac(oData.results[0]), this.__setOtherFields(oData.results[0]),
												this.__setCofog(oData.results[0]), this.__setElenchi(oData.results[0]), this.__setFieldPosizioneFinanziariaIrap(oData.results[0])
												])
										.then((res) => {
											this.__setVisibleFieldCapitolo(modelPosFin, false)
											this.getView().setBusy(false)
											resolve(oData)
										})
										.catch(err => {
											this.getView().setBusy(false)
											let oError = JSON.parse(err.responseText)
											MessageBox.error(oError.error.message.value)
										})
									})
							} else {
								this.getView().setBusy(false)
								resolve(null)
							}	
					},
					error:  (err) => {
						this.getView().setBusy(false)
					}
				})
			})
		},
		__setVisibleFieldCapitolo: function (modelPosFin, state) {
			modelPosFin.setProperty("/gestioneCampiEditabili/ammin", state)
			modelPosFin.setProperty("/gestioneCampiEditabili/missione", state)
			modelPosFin.setProperty("/gestioneCampiEditabili/programma", state)
			modelPosFin.setProperty("/gestioneCampiEditabili/azione", state)
			modelPosFin.setProperty("/gestioneCampiEditabili/titolo", state)
			modelPosFin.setProperty("/gestioneCampiEditabili/categoria", state)
			modelPosFin.setProperty("/gestioneCampiEditabili/cdr", state)
			modelPosFin.setProperty("/gestioneCampiEditabili/ragioneria", state)
			modelPosFin.setProperty("/gestioneCampiEditabili/mac", state)
			modelPosFin.setProperty("/gestioneCampiEditabili/tipofondo", state)
			modelPosFin.setProperty("/gestioneCampiEditabili/tipoSpesaCapitolo", state)
			modelPosFin.setProperty("/gestioneCampiEditabili/naturaSpesa", state)
			modelPosFin.setProperty("/gestioneCampiEditabili/memoria", state)
			modelPosFin.setProperty("/gestioneCampiEditabili/capitolone", state)
			modelPosFin.setProperty("/gestioneCampiEditabili/cuirapnocu", state)
			modelPosFin.setProperty("/gestioneCampiEditabili/noipa", state)
			modelPosFin.setProperty("/gestioneCampiEditabili/CDCapitolo", state)
			modelPosFin.setProperty("/gestioneCampiEditabili/den_estesa_capitolo", state)
			modelPosFin.setProperty("/gestioneCampiEditabili/den_breve_capitolo", state)
			modelPosFin.setProperty("/gestioneCampiEditabili/enableElenchi", state)
			modelPosFin.setProperty("/gestioneCampiEditabili/enableCofog", state)
		},
		__setFieldTitolo: function (oPosFin) {
			const modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getView().getModel("modelPosFin")
			let filtersTitolo = [new Filter("Fikrs", FilterOperator.EQ, "S001"),
								new Filter("Fase", FilterOperator.EQ, "NV"),
								new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
								// new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
								new Filter("Eos", FilterOperator.EQ, "S"),
								new Filter("Titolo", FilterOperator.EQ, oPosFin.Titolo), 
								new Filter("Categoria", FilterOperator.EQ, oPosFin.Categoria),
								new Filter("Ce2", FilterOperator.EQ, oPosFin.Ce2),
								new Filter("Ce3", FilterOperator.EQ, oPosFin.Ce3),
							]
			if(modelPosFin.getProperty("/infoSottoStrumento/Reale") == "S")
				filtersTitolo.push(new Filter({
					filters: [
								new Filter("Reale", FilterOperator.EQ, "R"),
								new Filter("Reale", FilterOperator.EQ, "S0001")
							],
					and : false
				}))
			else
				filtersTitolo.push(new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")))

			return new Promise(function (resolve, reject) {
				modelHana.read("/TipTitoloSet", {
					filters: filtersTitolo,
					success: function (oData) {
						
						modelPosFin.setProperty("/detailAnagrafica/TITOLO", oData.results.length > 0 ? oData.results[0].Titolo : null)
						modelPosFin.setProperty("/detailAnagrafica/DESC_TITOLO",  oData.results.length > 0 ? oData.results[0].DescEstesaTitolo : null)
						modelPosFin.setProperty("/detailAnagrafica/CATEGORIA",  oData.results.length > 0 ? oData.results[0].Categoria : null)
						modelPosFin.setProperty("/detailAnagrafica/DESC_CATEGORIA",  oData.results.length > 0 ? oData.results[0].DescEstesaCategoria : null)
						if(modelPosFin.getProperty("/onModify")) {
							modelPosFin.setProperty("/detailAnagrafica/CE2", oData.results.length > 0 ?  oData.results[0].Ce2 : null)
							modelPosFin.setProperty("/detailAnagrafica/DESC_CE2", oData.results.length > 0 ?  oData.results[0].DescEstesaCe2 : null)
							modelPosFin.setProperty("/detailAnagrafica/CE3", oData.results.length > 0 ? oData.results[0].Ce3 : null)
							modelPosFin.setProperty("/detailAnagrafica/DESC_CE3", oData.results.length > 0 ? oData.results[0].DescEstesaCe3 : null)
						}
						
						resolve()
					}
				})
			})
		},
		__setFieldMissione: function (oPosFin) {
			const modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getView().getModel("modelPosFin")
			let filtersMissione= [new Filter("Fikrs", FilterOperator.EQ, "S001"),
								new Filter("Fase", FilterOperator.EQ, "NV"),
								new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
								// new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
								new Filter("Missione", FilterOperator.EQ, oPosFin.Missione), 
								new Filter("Programma", FilterOperator.EQ, oPosFin.Programma),
								new Filter("Azione", FilterOperator.EQ, oPosFin.Azione),
								new Filter("Prctr", FilterOperator.EQ, oPosFin.Prctr),
								new Filter("Eos", FilterOperator.EQ, "S")
							]
			if(modelPosFin.getProperty("/infoSottoStrumento/Reale") == "S")
				filtersMissione.push(new Filter({
					filters: [
								new Filter("Reale", FilterOperator.EQ, "R"),
								new Filter("Reale", FilterOperator.EQ, "S0001")
							],
					and : false
				}))
			else
				filtersMissione.push(new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")))

			return new Promise(function (resolve, reject) {
				modelHana.read("/TipMissioneSet", {
					filters: filtersMissione,
					success: function (oData) {

						modelPosFin.setProperty("/detailAnagrafica/MISSIONE",oData.results.length > 0 ? oData.results[0].Missione : null)
						modelPosFin.setProperty("/detailAnagrafica/DESC_MISSIONE",oData.results.length > 0 ? oData.results[0].DescEstesaMissione : null)
						modelPosFin.setProperty("/detailAnagrafica/PROGRAMMA",oData.results.length > 0 ? oData.results[0].Programma : null)
						modelPosFin.setProperty("/detailAnagrafica/DESC_PROGRAMMA",oData.results.length > 0 ? oData.results[0].DescEstesaProgramma : null)
						modelPosFin.setProperty("/detailAnagrafica/AZIONE",oData.results.length > 0 ? oData.results[0].Azione : null)
						modelPosFin.setProperty("/detailAnagrafica/DESC_AZIONE",oData.results.length > 0 ? oData.results[0].DescEstesaAzione : null)
						resolve()
					}
				})
			})
		},
		__setFieldCdr: function (oPosFin) {
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getView().getModel("modelPosFin")
			let filtersCdr = [new Filter("Fikrs", FilterOperator.EQ, "S001"),
									  new Filter("Fase", FilterOperator.EQ, "NV"),
									  new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
									//   new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
									  new Filter("Prctr", FilterOperator.EQ, oPosFin.Prctr),
									  new Filter("Cdr", FilterOperator.EQ, oPosFin.Cdr),
									  new Filter("Datbis", FilterOperator.GE, new Date()),
									  
									]
			if(modelPosFin.getProperty("/infoSottoStrumento/Reale") == "S")
				filtersCdr.push(new Filter({
								filters: [
											new Filter("Reale", FilterOperator.EQ, "R"),
											new Filter("Reale", FilterOperator.EQ, "S0001")
										],
								and : false
							}))
			else
				filtersCdr.push(new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")))

				return new Promise((resolve, reject) => {
					modelHana.read("/TipCdrSet",{ //TipAmministrazioneSet
						filters: filtersCdr,
						success: (oData) => {
								// if(oData.results.length > 0)
								// let oCdr = oData.results[0].TipCdr.results.filter(item => item.Cdr === oPosFin.Cdr && item.Prctr === oPosFin.Prctr)[0]
								modelPosFin.setProperty("/detailAnagrafica/CDR", oData.results.length > 0 ? oData.results[0].Cdr : null)
								modelPosFin.setProperty("/detailAnagrafica/CDR_DESCR",oData.results.length > 0 ?  oData.results[0].DescEstesaCdr : null)
							resolve()
						},
						error:  (err) => {
							//debugger
						}
					})
			})
		},
		__setFieldRagioneria: function (oPosFin) {
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getView().getModel("modelPosFin")
			let filtersRagioneria = [new Filter("Fikrs", FilterOperator.EQ, "S001"),
									new Filter("Fase", FilterOperator.EQ, "NV"),
									new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
									// new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
									new Filter("Ragioneria", FilterOperator.EQ, oPosFin.Ragioneria),
									
								]
			if(modelPosFin.getProperty("/infoSottoStrumento/Reale") == "S")
				filtersRagioneria.push(new Filter({
					filters: [
								new Filter("Reale", FilterOperator.EQ, "R"),
								new Filter("Reale", FilterOperator.EQ, "S0001")
							],
					and : false
				}))
			else
				filtersRagioneria.push(new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")))

			return new Promise((resolve, reject) => {
				modelHana.read("/TipRagioneriaSet", {
					filters: filtersRagioneria,
					success: (oData) => {
						modelPosFin.setProperty("/detailAnagrafica/DESC_RAG",oData.results.length > 0 ? oData.results[0].DescEstesaRagioneria : null )
						modelPosFin.setProperty("/detailAnagrafica/RAG",oData.results.length > 0 ? oData.results[0].Ragioneria : null)
						resolve()
					}
				})
			})
		},
		__setFieldMac: function (oPosFin) {
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getView().getModel("modelPosFin")
			return new Promise((resolve, reject) => {
				modelHana.read("/MacSet", {
					filters: [new Filter("NumeCodDett", FilterOperator.EQ, oPosFin.Mac)],
					success: (oData) => {
						modelPosFin.setProperty("/detailAnagrafica/MAC",oData.results.length > 0 ? oData.results[0].NumeCodDett : null)
						modelPosFin.setProperty("/detailAnagrafica/DESC_MAC",oData.results.length > 0 ? oData.results[0].DescEstesa : null)
						resolve()
					}
				})
			})
		},
		__setOtherFields: function (oPosFin) {
			let modelPosFin = this.getView().getModel("modelPosFin")
			modelPosFin.setProperty("/detailAnagrafica/UdvL1", oPosFin.UdvL1Spe)
			modelPosFin.setProperty("/detailAnagrafica/UdvL2", oPosFin.UdvL2Spe)
			modelPosFin.setProperty("/detailAnagrafica/tipoFondo", oPosFin.TipoFondo)
			modelPosFin.setProperty("/detailAnagrafica/tipoSpesaCapitolo", oPosFin.CodiceTipospCapSpe)
			modelPosFin.setProperty("/detailAnagrafica/CodiceNaturaSpesa", oPosFin.NaturaSpesa)
			modelPosFin.setProperty("/detailAnagrafica/Memoria", oPosFin.FlagMemcor01)
			modelPosFin.setProperty("/detailAnagrafica/Capitolone", oPosFin.Capitolone)
			modelPosFin.setProperty("/detailAnagrafica/CuIrapNoncu", oPosFin.CuIrapNoncu)
			modelPosFin.setProperty("/detailAnagrafica/StatusCapitolo", oPosFin.StatusCapitolo === "3"  ? false : true)
			modelPosFin.setProperty("/detailAnagrafica/StatusPg", oPosFin.StatusPg === "3"  ? false : true)
			modelPosFin.setProperty("/detailAnagrafica/Noipa", oPosFin.Noipa)
			modelPosFin.setProperty("/detailAnagrafica/Tcrf", oPosFin.Tcrf)
			modelPosFin.setProperty("/detailAnagrafica/FOFP", oPosFin.CodiFofpSpe)
			if(modelPosFin.getProperty("/onModify")) {
				modelPosFin.setProperty("/detailAnagrafica/TipoSpesaPg", oPosFin.TipoSpesaPg)
				modelPosFin.setProperty("/detailAnagrafica/AreaDestinataria", oPosFin.AreaDestinataria)
				modelPosFin.setProperty("/detailAnagrafica/ObiettiviMinisteri", oPosFin.ObiettiviMinisteri)
				modelPosFin.setProperty("/detailAnagrafica/RuoliSpesaFissa", oPosFin.RuoliSpesaFissa)
			}
			modelPosFin.updateBindings(true)
			
		},
		__resetAttributiCapitolo: function () {
			let modelPosFin = this.getView().getModel("modelPosFin")

			modelPosFin.setProperty("/detailAnagrafica/UdvL1", null)
			modelPosFin.setProperty("/detailAnagrafica/UdvL2", null)
			modelPosFin.setProperty("/detailAnagrafica/tipoFondo", null)
			modelPosFin.setProperty("/detailAnagrafica/tipoSpesaCapitolo", null)
			modelPosFin.setProperty("/detailAnagrafica/CodiceNaturaSpesa", null)
			modelPosFin.setProperty("/detailAnagrafica/Memoria", false)
			modelPosFin.setProperty("/detailAnagrafica/Capitolone", false)
			modelPosFin.setProperty("/detailAnagrafica/CuIrapNoncu", "0")
			modelPosFin.setProperty("/detailAnagrafica/StatusCapitolo", false)
			modelPosFin.setProperty("/detailAnagrafica/StatusPg", false)
			modelPosFin.setProperty("/detailAnagrafica/Noipa", "")
			//Titolo
			modelPosFin.setProperty("/detailAnagrafica/TITOLO", null)
			modelPosFin.setProperty("/detailAnagrafica/DESC_TITOLO", null)
			modelPosFin.setProperty("/detailAnagrafica/CATEGORIA", null)
			modelPosFin.setProperty("/detailAnagrafica/DESC_CATEGORIA",  null)
			//reset Ce2 e Ce3 perchè dipendenti da categoria
			modelPosFin.setProperty("/detailAnagrafica/CE2", null)
			modelPosFin.setProperty("/detailAnagrafica/DESC_CE2", null)
			modelPosFin.setProperty("/detailAnagrafica/CE3", null)
			modelPosFin.setProperty("/detailAnagrafica/DESC_CE3", null)
			//Missione
			modelPosFin.setProperty("/detailAnagrafica/MISSIONE", null)
			modelPosFin.setProperty("/detailAnagrafica/DESC_MISSIONE", null)
			modelPosFin.setProperty("/detailAnagrafica/PROGRAMMA", null)
			modelPosFin.setProperty("/detailAnagrafica/DESC_PROGRAMMA", null)
			modelPosFin.setProperty("/detailAnagrafica/AZIONE", null)
			modelPosFin.setProperty("/detailAnagrafica/DESC_AZIONE", null)
			//Cdr
			modelPosFin.setProperty("/detailAnagrafica/CDR", null)
			modelPosFin.setProperty("/detailAnagrafica/CDR_DESCR", null)
			//Ragioneria
			modelPosFin.setProperty("/detailAnagrafica/DESC_RAG", null)
			modelPosFin.setProperty("/detailAnagrafica/RAG", null)
			//Mac
			modelPosFin.setProperty("/detailAnagrafica/DESC_MAC", null)
			modelPosFin.setProperty("/detailAnagrafica/MAC", null)
			//Denominazione Capitolo
			modelPosFin.setProperty("/detailAnagrafica/DESC_CAPITOLO", null)
			modelPosFin.setProperty("/detailAnagrafica/CD_CAPITOLO_DEN_EST", null)
			modelPosFin.setProperty("/detailAnagrafica/CD_CAPITOLO_DEN_BREVE", null)
			modelPosFin.setProperty("/detailAnagrafica/CODICE_STANDARD_CAPITOLO", null)
			//Elenchi
			modelPosFin.setProperty("/detailAnagrafica/elenchiCapitolo", [])
			//Cofog
			modelPosFin.setProperty("/detailAnagrafica/elencoCOFOG", [])

			modelPosFin.updateBindings(true)
		},
		__setFieldPosizioneFinanziariaIrap: function (oPosFin) {
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getView().getModel("modelPosFin")
			let aFiltersIrap = [new Filter("Fikrs", FilterOperator.EQ, "S001"),
								new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
								new Filter("Capitolo", FilterOperator.EQ, oPosFin.Capitolo),
								new Filter("Prctr", FilterOperator.EQ, oPosFin.Prctr),
								new Filter("Eos", FilterOperator.EQ, oPosFin.Eos),
								new Filter("Fase", FilterOperator.EQ, oPosFin.Fase),
								// new Filter("Reale", FilterOperator.EQ, oPosFin.Reale)
							]
			if(modelPosFin.getProperty("/infoSottoStrumento/Reale") == "S")
				aFiltersIrap.push(new Filter({
					filters: [
								new Filter("Reale", FilterOperator.EQ, "R"),
								new Filter("Reale", FilterOperator.EQ, "S0001")
							],
					and : false
				}))
			else
				aFiltersIrap.push(new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")))

			return new Promise((resolve, reject) => {
				modelHana.read("/PosizioneFinanziariaIrapSet", {
					filters: aFiltersIrap,
					success: (oData) => {
						modelPosFin.setProperty("/detailAnagrafica/PosizioneFinanziariaIrap", oData.results)
						resolve()
					}
				})
			})
		},
		__setCollegamenti(oPosFin){
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getView().getModel("modelPosFin")
			let aFilters = [	new Filter("Fikrs", FilterOperator.EQ, "S001"),
								new Filter("Fase", FilterOperator.EQ, "NV"),
								new Filter("PosfinRic", FilterOperator.EQ, oPosFin.Fipex ),//oPosFin.Fipex.replaceAll(".", "")
								new Filter("AnnoRic", FilterOperator.EQ, oPosFin.Anno), //lt inserisco Anno da pos fin
								new Filter("Attivo", FilterOperator.EQ, "X"),
								new Filter("Versione", FilterOperator.EQ, oPosFin.Versione), //lt inserisco versione da pos fin
								// new Filter("Reale", FilterOperator.EQ, oPosFin.Reale), //lt inserisco Reale da pos fin
							]
			if(oPosFin.Reale == "S")
				aFilters.push(new Filter({
					filters: [
								new Filter("Reale", FilterOperator.EQ, "R"),
								new Filter("Reale", FilterOperator.EQ, "S0001")
							],
					and : false
				}))
			else
				aFilters.push(new Filter("Reale", FilterOperator.EQ, oPosFin.Reale))

			return new Promise((resolve, reject) => {
				modelHana.read("/CollegamentiSet", {
					filters: aFilters,
					success: async (oData) => {
						if(oData.results.length > 0) {
							modelPosFin.setProperty("/detailAnagrafica/collegamenti", oData.results)
						}else{
							modelPosFin.setProperty("/detailAnagrafica/collegamenti", [])
						}
						resolve()
					}
				})
			})
		},
		__setFieldCapPg(oPosFin){
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getView().getModel("modelPosFin")
			let aFiltersCapPg = [new Filter("Fikrs", FilterOperator.EQ, "S001"),
								new Filter("Fase", FilterOperator.EQ, "NV"),
								new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
								new Filter("Capitolo", FilterOperator.EQ, oPosFin.Capitolo),
								new Filter("Prctr", FilterOperator.EQ, oPosFin.Prctr),
								// new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
								new Filter("Pg", FilterOperator.EQ, oPosFin.Pg),
								new Filter("Eos", FilterOperator.EQ, "S")
							]
			if(oPosFin.Reale === "S0001")
				aFiltersCapPg.push(new Filter({
					filters: [
								new Filter("Reale", FilterOperator.EQ, "R"),
								new Filter("Reale", FilterOperator.EQ, "S0001")
							],
					and : false
				}))
			else
				aFiltersCapPg.push(new Filter("Reale", FilterOperator.EQ, oPosFin.Reale))

			return new Promise((resolve, reject) => {
				modelHana.read("/TipCapitoloSet", {
					filters: aFiltersCapPg,
					success: async (oData) => {
						if(oData.results.length > 0) {
							modelPosFin.setProperty("/detailAnagrafica/pg", oData.results[0].Pg)
							modelPosFin.setProperty("/detailAnagrafica/CAPITOLO", oData.results[0].Capitolo)
							modelPosFin.setProperty("/detailAnagrafica/DESC_CAPITOLO", oData.results[0].DescEstesaCapitolo)
							modelPosFin.setProperty("/detailAnagrafica/DESC_PG", oData.results[0].DescEstesaPg)
							modelPosFin.setProperty("/detailAnagrafica/VersionePg", oData.results[0].VersionePg)
							modelPosFin.setProperty("/detailAnagrafica/VersioneCapitolo", oData.results[0].VersioneCapitolo)
							if( oData.results[0].CodiceStdPg !== "000") {
								await this.__setCodeStandard(oData.results[0], "CodiceStdPg", "CODICE_STANDARD_PG", "CD_PG_DEN_EST", "CD_PG_DEN_BREVE")
								modelPosFin.setProperty("/gestioneCampiEditabili/den_breve_pg", false)
								modelPosFin.setProperty("/gestioneCampiEditabili/den_estesa_pg", false)
							} else {
								modelPosFin.setProperty("/detailAnagrafica/CD_PG_DEN_EST", oData.results[0].DescEstesaPg)
								modelPosFin.setProperty("/detailAnagrafica/CD_PG_DEN_BREVE", oData.results[0].DescBrevePg)
								modelPosFin.setProperty("/detailAnagrafica/CODICE_STANDARD_PG", null)
								modelPosFin.setProperty("/gestioneCampiEditabili/den_breve_pg", true)
								modelPosFin.setProperty("/gestioneCampiEditabili/den_estesa_pg", true)
							}
							if( oData.results[0].CodiceStdCapitolo !== "000"){
								await this.__setCodeStandard(oData.results[0], "CodiceStdCapitolo", "CODICE_STANDARD_CAPITOLO", "CD_CAPITOLO_DEN_EST", "CD_CAPITOLO_DEN_BREVE")
								modelPosFin.setProperty("/gestioneCampiEditabili/den_breve_capitolo", false)
								modelPosFin.setProperty("/gestioneCampiEditabili/den_estesa_capitolo", false)
							} else {
								modelPosFin.setProperty("/detailAnagrafica/CD_CAPITOLO_DEN_EST", oData.results[0].DescEstesaCapitolo)
								modelPosFin.setProperty("/detailAnagrafica/CD_CAPITOLO_DEN_BREVE", oData.results[0].DescBreveCapitolo)
								modelPosFin.setProperty("/detailAnagrafica/CODICE_STANDARD_CAPITOLO", null)
								modelPosFin.setProperty("/gestioneCampiEditabili/den_breve_capitolo", true)
								modelPosFin.setProperty("/gestioneCampiEditabili/den_estesa_capitolo", true)
							}
						}
						resolve()
					}
				})
			})
		},
		__setCodeStandard: function (oCapitolo, sPath, sCodice, sEstesa, sRidotta) {
			let modelPosFin = this.getView().getModel("modelPosFin")
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			const aFilterCS = [new Filter("Fikrs", FilterOperator.EQ, "S001"),
								new Filter("Fase", FilterOperator.EQ, "NV"),
								new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
								// new Filter("Reale", FilterOperator.EQ, oCapitolo.Reale),
								new Filter("CodiceStd", FilterOperator.EQ, oCapitolo[sPath])
							]
			if(oCapitolo.Reale === "S0001")
				aFilterCS.push(new Filter({
					filters: [
						new Filter("Reale", FilterOperator.EQ, 'S0001'),
						new Filter("Reale", FilterOperator.EQ, 'R')
					],
					and: false
				}))
			else	
				aFilterCS.push(new Filter("Reale", FilterOperator.EQ, oCapitolo.Reale))
				
			return new Promise((resolve, reject) => {
				modelHana.read("/CodiceStandardSet", {
					filters: aFilterCS,
					success: (oData) => {
						if(oData.results.length > 0) {
							modelPosFin.setProperty("/detailAnagrafica/" + sCodice, oData.results[0].CodiceStd)
							modelPosFin.setProperty("/detailAnagrafica/" + sEstesa, oData.results[0].DescEstesa)
							modelPosFin.setProperty("/detailAnagrafica/" + sRidotta, oData.results[0].DescBreve)
							modelPosFin.updateBindings(true)
						}
						resolve()
					}
				})
			})
		},
		__setFieldAmmin: function (oPosFin) {
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getView().getModel("modelPosFin")
			let aFiltersAmm = [new Filter("Fikrs", FilterOperator.EQ, "S001"),
								new Filter("Fase", FilterOperator.EQ, "NV"),
								new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
								new Filter("Prctr", FilterOperator.EQ, oPosFin.Prctr),
								// new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
								new Filter("Datbis", FilterOperator.GE, new Date())
							]
			if(modelPosFin.getProperty("/infoSottoStrumento/Reale") == "S")
				aFiltersAmm.push(new Filter({
					filters: [
								new Filter("Reale", FilterOperator.EQ, "R"),
								new Filter("Reale", FilterOperator.EQ, "S0001")
							],
					and : false
				}))
			else
				aFiltersAmm.push(new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")))

			return new Promise((resolve, reject) => {
				modelHana.read("/TipAmministrazioneSet", {
					filters: aFiltersAmm,
					success: (oData) => {
						if(oData.results.length > 0) {
							modelPosFin.setProperty("/detailAnagrafica/AMMINISTAZIONE", oData.results[0].Prctr)
							modelPosFin.setProperty("/detailAnagrafica/DESC_AMMINISTAZIONE", oData.results[0].DescEstesa)
						}
						resolve()
					}
				})
			})
		},
		__setUdv: function (oAmmProMiss) {
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getView().getModel("modelPosFin")
			return new Promise((resolve, reject) => {
				modelHana.read("/UdvSpesaSet", {
					filters: [ new Filter("Fikrs", FilterOperator.EQ, "S001"),
								new Filter("Fase", FilterOperator.EQ, "NV"),
								new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
								new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
								new Filter("Prctr", FilterOperator.EQ, oAmmProMiss.Prctr),
								new Filter("Missione", FilterOperator.EQ, oAmmProMiss.Missione),
								new Filter("Programma", FilterOperator.EQ, oAmmProMiss.Programma),
								],
					success: (oData) => {
						modelPosFin.setProperty("/detailAnagrafica/UdvL1", oData.results.length > 0 ? oData.results[0].UdvL1 : "")
						modelPosFin.setProperty("/detailAnagrafica/UdvL2", oData.results.length > 0 ? oData.results[0].UdvL2 : "")
						resolve()
					}
				})
			})
		},
		onResetSelectionSH: function (oEvent) {
			debugger

		},
		onSearchDescr: function (oEvent) {
			var customData =oEvent.getSource().data()
			var key = Object.keys(customData)

			var filters = []
			key.forEach(el => {				
				filters.push(new Filter(customData[el], FilterOperator.Contains, oEvent.getParameter("query")))
			});

			oEvent.getSource().getParent().getParent()
					.getBinding("items").filter(new Filter({
									filters: filters,
									and: false,
			 						 }))															   
		},
		onSearchDescrOld: function (oEvent) {
			let {_, value} = oEvent.getSource().getCustomData()[0].mProperties
			let  sCodice = oEvent.getSource().getCustomData()[1].getValue()
			oEvent.getSource().getParent().getParent()
					.getBinding("items").filter(new Filter({
									filters: [new Filter(value, FilterOperator.Contains, oEvent.getParameter("query")),
											  new Filter(sCodice, FilterOperator.Contains, oEvent.getParameter("query"))],
									and: false,
			 						 }))															   
		},
		onChangeCapitolo: async function (oEvent) {
			//se è stato aggiornato manualmente il capitolo, mette a null la descrizione
			let modelPosFin = this.getView().getModel("modelPosFin")
			// modelPosFin.setProperty("/detailAnagrafica/DESC_CAPITOLO", null)
			// modelPosFin.setProperty("/detailAnagrafica/CD_CAPITOLO_DEN_EST", null)
			// modelPosFin.setProperty("/detailAnagrafica/CD_CAPITOLO_DEN_BREVE", null)
			if(!modelPosFin.getProperty("/detailAnagrafica/CAPITOLO")) {
				this.__resetAttributiCapitolo()
				this.__setVisibleFieldCapitolo(modelPosFin, true)
			}
			if(modelPosFin.getProperty("/detailAnagrafica/CAPITOLO").length === 4 && modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE")) {
				this.getView().setBusy(true)
				let oDataCapitolo = await this.__getCapitolo()
				let oDataPosFin = await this.__getAttributiCapitoloFromPosFin()
				if(oDataPosFin){
					return Promise.all([this.__setFieldTitolo(oDataPosFin.results[0]), this.__setFieldMissione(oDataPosFin.results[0]), this.__setFieldCdr(oDataPosFin.results[0]),
									this.__setFieldRagioneria(oDataPosFin.results[0]), this.__setFieldMac(oDataPosFin.results[0]), this.__setCofog(oDataPosFin.results[0]),
									this.__setElenchi(oDataPosFin.results[0]), this.__setOtherFields(oDataPosFin.results[0])
									])
							.then((res) => {
								if(oDataCapitolo){ //estrazione codici standard o denominazioni
									if(oDataCapitolo.results[0].COD_DENOM_STD !== "000"){
										this.__setCodeStandard(oDataCapitolo.results[0], "COD_DENOM_STD", "CODICE_STANDARD_CAPITOLO", "CD_CAPITOLO_DEN_EST", "CD_CAPITOLO_DEN_BREVE")
									} else {
										modelPosFin.setProperty("/detailAnagrafica/CD_CAPITOLO_DEN_EST", oDataCapitolo.results[0].DESCR_ESTESA)
										modelPosFin.setProperty("/detailAnagrafica/CD_CAPITOLO_DEN_BREVE", oDataCapitolo.results[0].DESC_BREVE)
										modelPosFin.setProperty("/detailAnagrafica/CODICE_STANDARD_CAPITOLO", null)
									}
									modelPosFin.setProperty("/detailAnagrafica/VersioneCapitolo", oDataCapitolo.results[0].VERSIONE)
									modelPosFin.setProperty("/detailAnagrafica/pg", null)
								}
								this.__setVisibleFieldCapitolo(modelPosFin, false)
								this.getView().setBusy(false)
							})
							.catch(err => {
								this.getView().setBusy(false)
								let oError = JSON.parse(err.responseText)
								MessageBox.error(oError.error.message.value)
							})
				} else {
					modelPosFin.setProperty("/detailAnagrafica/pg", "01")
					this.__setVisibleFieldCapitolo(modelPosFin, true)
					this.__resetAttributiCapitolo() 
					// if(modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE") && modelPosFin.getProperty("/detailAnagrafica/MISSIONE") && modelPosFin.getProperty("/detailAnagrafica/PROGRAMMA"))
					// 	this.__setUdv({
					// 		Prctr: modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE"),
					// 		Programma: modelPosFin.getProperty("/detailAnagrafica/PROGRAMMA"),
					// 		Missione: modelPosFin.getProperty("/detailAnagrafica/MISSIONE")
					// 	})
					this.getView().setBusy(false)
				}
			}else{
				
				this.__resetAttributiCapitolo() 
			}
		},
		__getCapitolo: function () {
			const modelTopologiche = this.getOwnerComponent().getModel("sapHanaS2Tipologiche") 
			let modelPosFin = this.getView().getModel("modelPosFin")
			let aFiltersCap = [new Filter("FIKRS", FilterOperator.EQ, "S001"),
								new Filter("FASE", FilterOperator.EQ, "NV"),
								new Filter("ANNO", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
								new Filter("CODICE_CAPITOLO", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/CAPITOLO")),
								new Filter("PRCTR", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE")),
								new Filter("REALE", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
								new Filter("EOS", FilterOperator.EQ, "S")
								]
				return new Promise((resolve, reject) => {
					modelTopologiche.read("/ZES_CAPITOLO_SET",{
						filters: aFiltersCap,
						urlParameters: {
							$top: 2
						},
						success: (oData) => {
							if(oData.results.length > 0)
								resolve(oData)
							else 
								resolve(null)
						},
						error:  (err) => {
							resolve(null)
						}
					})
				})
		},
		__getAttributiCapitoloFromPosFin: function () {
			const modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getView().getModel("modelPosFin")
			return new Promise((resolve, reject) => {
				modelHana.read("/PosizioneFinanziariaSet", {
					filters: [new Filter("Fikrs", FilterOperator.EQ, "S001"),
								new Filter("Fase", FilterOperator.EQ, "NV"),
								new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
								new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
								new Filter("Datbis", FilterOperator.GE, new Date()),
								new Filter("Eos", FilterOperator.EQ, "S"),
								new Filter("Capitolo", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/CAPITOLO")),
								new Filter("Prctr", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE"))
							],
					success: (oData) => {
						if(oData.results.length > 0) {
							if(oData.results.find(item => item.Versione === "P")){
								oData.results = oData.results.filter(item => item.Versione === "P")
							}
							resolve(oData)
						} else {
							resolve(null)
						}	
					},
					error:  (err) => {
						resolve(null)
					}
				})
			})
		},
		createAmminFilter: function () {
			let modelPosFin = this.getView().getModel("modelPosFin")	
		},
		onValueHelpCodStd: function (oEvent) {
			let modelPosFin = this.getView().getModel("modelPosFin")
			let {_, value} = oEvent.getSource().getCustomData()[0].mProperties
			if(oEvent.getSource().getAggregation("customData")[0].getProperty("key")==="Articolo"){
				var oObj  = {CodiceSelected:"CodiceStandardArticolo"};
			}else if(oEvent.getSource().getAggregation("customData")[0].getProperty("key")==="pg"){
				var oObj  = {CodiceSelected:"CodiceStandardPG"};
			}else{
				var oObj  = {CodiceSelected:"CodiceStandardCapitolo"};
			}
			this.getView().setModel(new JSONModel(oObj),"modelInfo")
			modelPosFin.setProperty("/CodStd_HV", value)
			Fragment.load({
				name:"zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.HVPosFin.HVCodiceStandard",
				controller: this
			}).then(oDialog => {
				this[value] = oDialog
				this.getView().addDependent(oDialog);
				this[value].open()
			})
		},
		onModifyCodStandard: function (oEvent) {
			let {_, value} = oEvent.getSource().getCustomData()[0].mProperties
			const modelPosFin = this.getView().getModel("modelPosFin")
			if(value === "CodiceStandardCapitolo"){
				modelPosFin.setProperty("/detailAnagrafica/CD_CAPITOLO_DEN_EST", null)
				modelPosFin.setProperty("/detailAnagrafica/CD_CAPITOLO_DEN_BREVE", null)
				modelPosFin.setProperty("/gestioneCampiEditabili/den_breve_capitolo", true)
				modelPosFin.setProperty("/gestioneCampiEditabili/den_estesa_capitolo", true)
			}
			if(value === "CodiceStandardPG") {
				modelPosFin.setProperty("/detailAnagrafica/CD_PG_DEN_EST", null)
				modelPosFin.setProperty("/detailAnagrafica/CD_PG_DEN_BREVE", null)
				modelPosFin.setProperty("/gestioneCampiEditabili/den_breve_pg", true)
				modelPosFin.setProperty("/gestioneCampiEditabili/den_estesa_pg", true)
			}
			modelPosFin.updateBindings(true)
		},
		onHVCodiceElenco: function (oEvent) {
			let modelPosFin = this.getView().getModel("modelPosFin")
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			// modelHana.read("/CapitoloElencoSet", {
			// 	filters: [new Filter("Fikrs", FilterOperator.EQ, "S001"),
			// 	new Filter("Fase", FilterOperator.EQ, "NV"),
			// 	new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
			// 	new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale"))
			// 	new Filter("")
			//   ]
			// })
			Fragment.load({
				name:"zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.HVPosFin.HVCodiceElenco",
				controller: this
			}).then(oDialog => {
				this.HVCodiceElenco= oDialog
				this.getView().addDependent(oDialog);
				this.HVCodiceElenco.open()
			})
		},
		__getDescCofog: function(oCofog) {
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			return new Promise((resolve, reject) => {
				modelHana.read("/CofogSet", {
					filters: [
							new Filter("Fikrs", FilterOperator.EQ, "S001"),
							new Filter("Fase", FilterOperator.EQ, "NV"),
							new Filter("Anno", FilterOperator.EQ, oCofog.Anno),
							new Filter("Reale", FilterOperator.EQ, oCofog.Reale),
							new Filter("CofogL1", FilterOperator.EQ, oCofog.CofogL1),
							new Filter("CofogL2", FilterOperator.EQ, oCofog.CofogL2),
							new Filter("CofogL3", FilterOperator.EQ, oCofog.CofogL3)
						],
					success: (oData) => {
						resolve(oData.results.length >0 ? oData.results[0].Desc : null)
					}
				})
			})	
		},
		formatPercent: function (sValue) {
			if(sValue.length === 3 && sValue[0] !== "1")
				return  sValue.substring(1, sValue.length)
			else 
				return sValue
		},
		onUpdatePercent: function (oEvent) {
			let modelPosFin = this.getView().getModel("modelPosFin")
			let sPath =   oEvent.getSource().getParent().getBindingContextPath()
			modelPosFin.setProperty(sPath + "/PercCofog", oEvent.getSource().getValue())
			// modelPosFin.updateBindings(true)
		},
		__getDescElenco: function (oElenco) {
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let aFilters =  [
				new Filter("Fikrs", FilterOperator.EQ, "S001"),
				new Filter("Fase", FilterOperator.EQ, "NV"),
				new Filter("Anno", FilterOperator.EQ, oElenco.Anno),
				// new Filter("Reale", FilterOperator.EQ, oElenco.Reale),
				new Filter("Prctr", FilterOperator.EQ, oElenco.PrctrElenco),
				new Filter("NumeroElenco", FilterOperator.EQ, oElenco.NumeroElenco)
			]
			if(oElenco.Reale === "S0001"){
				aFilters.push(new Filter({
					filters: [
						new Filter("Reale", FilterOperator.EQ, oElenco.Reale),
						new Filter("Reale", FilterOperator.EQ, 'R')
					],
					and: false
				}))
			} else {
				aFilters.push(new Filter("Reale", FilterOperator.EQ, oElenco.Reale))
			}
			return new Promise((resolve, reject) => {
				modelHana.read("/ElencoSet", {
					filters: aFilters,
					success: (oData) => {
						resolve(oData.results.length > 0 ? oData.results[0].DescEstesa : "")
					}
				})
			})	
		},
		onPosFinIRAP: function (oEvent) {
			var oButton = oEvent.getSource(),
			oView = this.getView();	
			const modelPosFin = this.getView().getModel("modelPosFin");
			let cuIrapNonCuSelected = modelPosFin.getProperty("/detailAnagrafica/CuIrapNoncu")

			if(cuIrapNonCuSelected !== "1" && cuIrapNonCuSelected !== "3" ){
				MessageBox.warning(this.recuperaTestoI18n("warningInsertIrap"))
				return
			}

			// create popover
			if (!this.popOverPosFinIRAP) {
				this.popOverPosFinIRAP = Fragment.load({
					id: oView.getId(),
					name: "zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.HVPosFin.PopOverPosFinIRAP",
					controller: this
				}).then(function(oPopover) {
					oView.addDependent(oPopover);
					return oPopover;
				});
			}
			this.popOverPosFinIRAP.then(function(oPopover) {
				oPopover.open();
			});
		},
		handleAddIrap: function(oEvent) {
			var oView = this.getView();
			let modelPosFin = this.getView().getModel("modelPosFin");
			modelPosFin.setProperty("/codiceElenco", null);
			modelPosFin.setProperty("/descElenco", null);
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let aFilters = [
				new Filter(
					"Fikrs",
					sap.ui.model.FilterOperator.EQ,
					modelPosFin.getProperty("/PosFin/Fikrs")
				), //Attualmente statico per necessità
				new Filter(
					"Anno",
					sap.ui.model.FilterOperator.EQ,
					modelPosFin.getProperty("/PosFin/Anno")
				),
				new Filter(
					"Fase",
					sap.ui.model.FilterOperator.EQ,
					modelPosFin.getProperty("/PosFin/Fase")
				),
				new Filter("Reale", sap.ui.model.FilterOperator.EQ, "R"),
				new Filter(
					"Prctr",
					FilterOperator.EQ,
					modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE")
				),
				// new Filter("LOEKZ", FilterOperator.EQ, ""),
			];
			if (
				modelPosFin.getProperty("/detailAnagrafica/elenchiCapitolo")
				.length > 0
			) {
				modelPosFin
					.getProperty("/detailAnagrafica/elenchiCapitolo")
					.map((el) =>
						aFilters.push(
							new Filter("NumeroElenco", FilterOperator.NE, el.NumeroElenco)
						)
					);
			}
			modelHana.read("/ElencoSet", {
				filters: aFilters,

				success: function(oData) {
					//oData.results = oData.results.filter(item => !(item.Prctr === "A020" && item.NumeroElenco === "1"))
					let aShowCapElenchi = [];
					oData.results = oData.results.filter(
						(el) => !(el.Prctr === "A020" && el.NumeroElenco === "001")
					);
					for (let i = 0; i < oData.results.length; i++) {
						if (!modelPosFin
							.getProperty("/detailAnagrafica/elenchiCapitolo")
							.find(
								(el) => oData.results[i].NumeroElenco === el.NumeroElenco
							)
						) {
							aShowCapElenchi.push(oData.results[i]);
						}
					}
					var codice_elenco = {
						codice_elenco: [],
					};
					modelPosFin.getData().formPosFin = codice_elenco;
					modelPosFin.setProperty(
						"/formPosFin/codice_elenco",
						aShowCapElenchi
					);
				},
			});
			this.getView().setModel(new JSONModel({CodiceAmmin: modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE")}), "modelFiltriHome");
			if (!this._handleAddIrap) {
				this._handleAddIrap = sap.ui.xmlfragment(
					"zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.HVPosFin.AddIrap",
					this
				);
				this.getView().addDependent(this._handleAddIrap);
				/* syncStyleClass(
					oView
					.getController()
					.getOwnerComponent()
					.getContentDensityClass(),
					oView,
					this._handleAddIrap
				); */
			}
			this._handleAddIrap.open();
		},
		addIrap: async function() {
			var that = this;
			var aIrapModel = that.getView().getModel("modelPosFin").getProperty("/detailAnagrafica/PosizioneFinanziariaIrap");
			var sIrapInput = sap.ui.getCore().byId("idInputGestPosFin").getValue();
			var sModelPosFinMC = that.getView().getModel("fipexIrapSelected");

			var obj = {
				Fipex: sModelPosFinMC.getProperty("/FIPEX"),
				CodificaRepPf: sModelPosFinMC.getProperty("/CODIFICA_REP_PF"),
				DescrBreve: sModelPosFinMC.getProperty("/DESCR_PG"),
				ADDFE: true,
				// "DESCR_ESTESA": sDescrIrap
			};
			if (aIrapModel) {
				var aIrapRecord = aIrapModel.find((a) => a.Fipex === obj.Fipex);
				if (aIrapRecord) {
					return MessageBox.error(this.recuperaTestoI18n("errIrapD"));
				} else {
					aIrapModel.push(obj);
					that.getView().getModel("modelPosFin").setProperty("/detailAnagrafica/PosizioneFinanziariaIrap", aIrapModel)
					that.getView().getModel("modelPosFin").refresh();
				}
			} else {
				that
					.getView()
					.getModel("modelPosFin")
					.setProperty("/detailAnagrafica/PosizioneFinanziariaIrap/", [obj]);
				// aIrapModel.push(obj);
				that.getView().getModel("modelPosFin").refresh();
			}

			that.handlecloseIrap();
		},
		onDeleteIrap: function(oEvent) {
			var sContextPath = oEvent
				.getSource()
				.getParent()
				.getBindingContextPath();
			var bCompact = !!this.getView().$().closest(".sapUiSizeCompact")
				.length;
			var that = this;
			var obj = this.getView().getModel("modelPosFin").getProperty(sContextPath)
			sap.m.MessageBox.warning(
				that.recuperaTestoI18n("onDeleteDomandaIrap"), {
					//id: "messageWarning",
					title: that.recuperaTestoI18n("opWa"),
					actions: [MessageBox.Action.OK, "Annulla"],
					styleClass: bCompact ? "sapUiSizeCompact" : "",
					onClose: function(sAction) {
						if (sAction === "OK") {							
							var sModelPosFin = that.getView().getModel("modelPosFin");
							var sArr = sModelPosFin.getProperty("/detailAnagrafica/PosizioneFinanziariaIrap/");
							const list = sArr.filter(el => el.Fipex !== obj.Fipex)
							sModelPosFin.setProperty("/detailAnagrafica/PosizioneFinanziariaIrap/",list);
						}
					},
				}
			);
		},
		handlecloseIrap: function() {
			if (this._handleAddIrap) {
				this._handleAddIrap.destroy();
				this._handleAddIrap = null;
			}
		},
		onSottostrumento: function () {
			var oModel = this.getOwnerComponent().getModel("sapHanaS2");
			var Dateto = new Date(new Date().getFullYear(), 11, 31);
			Dateto.setHours(2);
			var sottostrumentiModel = new JSONModel();
			var oView = this.getView();
			var _filters = [
				new Filter({
					path: "Dateto",
					operator: FilterOperator.EQ,
					value1: Dateto
				}),
				new Filter({
					path: "Fase",
					operator: FilterOperator.EQ,
					value1: "NV"
				}),
				new Filter({
					path: "TestoTipo",
					operator: FilterOperator.EQ,
					value1: "VLV"
				})
			];
			oModel.read("/Gest_PosFin_SottostrumentoSet", {
				filters: _filters,
				success: function(oData, response) {
					oData.results = oData.results.map((item) => {
						item.FkEseStrAnnoEse = Number(item.FkEseStrAnnoEse) + 1
						item.EseAnnoEse = Number(item.EseAnnoEse) + 1
						return item
					})
					sottostrumentiModel.setData(oData.results);
					sottostrumentiModel.setSizeLimit(2000);
					oView.setModel(sottostrumentiModel, "sottostrumentiModel");
				},
				error: function(e) {

				}
			});
			if(!this._oDialog){
				this._oDialog = sap.ui.xmlfragment(
					"zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.Sottostrumento",
					this);
				this._oDialog.setModel("sottostrumentiModel");
				this.getView().addDependent(this._oDialog);
				this._oDialog.open();
			} else {
				this._oDialog.open();
			}
		},
		onClose: function (oEvent) {
			oEvent.getSource().getParent().close()
		},
		onPressConfermaSottostrumento: function (oEvent) {
			let modelSottoStrumenti = this.getView().getModel("sottostrumentiModel")
			let modelHome = this.getView().getModel("modelHome")
			let idTableStr = sap.ui.getCore().byId("idTableSottostrumento2")
			let selectedPath = sap.ui.getCore().byId("idTableSottostrumento2").getSelectedContextPaths()[0]
			let selectedItem = modelSottoStrumenti.getProperty(selectedPath)
			modelHome.setProperty("/Sottostrumento", `${selectedItem.TestoTipo} - ${selectedItem.IdSstr} - ${selectedItem.EseAnnoEse}`)
			modelHome.setProperty("/infoSottoStrumento", selectedItem)
			modelHome.setProperty("/esercizio", Number(selectedItem.EseAnnoEse) + 1)
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
		onPressMatchCodeFragment: function (oEvent) {
			const {key, value} = oEvent.getSource().getCustomData()[0].mProperties
			if(!this[value]) {
				Fragment.load({
					name:"zsap.com.r3.cobi.s4.gestposfinnv.view.fragment." + value,
					controller: this
				}).then(oDialog => {
					this[value] = oDialog;
					this.getView().addDependent(oDialog);
					this[value].open();
				})
			} else {
				this[value].open();
			}
		},
		onSelectCuIrapNonCu: function (oEvent) {
			let modelPosFin = this.getView().getModel("modelPosFin")
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let filtersNOIpa = []
			
				if(modelPosFin.getProperty("/detailAnagrafica/CuIrapNoncu") === "1" && modelPosFin.getProperty("/detailAnagrafica/tipoSpesaCapitolo") === "OBB"){
					this.getView().getModel("modelPosFin").setProperty(`/detailAnagrafica/CuIrapNoncu`, "")
					MessageBox.warning(this.recuperaTestoI18n("Il CU/IRAP/NON CU Non può avere valore Cedolino Unico se il tipo spesa è Obbligatorio"))
					return
				}

			if(modelPosFin.getProperty("/detailAnagrafica/CuIrapNoncu") !== "0"){
				filtersNOIpa.push(new Filter("CuIrapNonCu", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/CuIrapNoncu")))
			}
			modelPosFin.setProperty("modelPosFin>/detailAnagrafica/Noipa", "")
			modelHana.read("/NoipaSet", {
				filters: filtersNOIpa,
				success: (oData) =>  {
					if(modelPosFin.getProperty("/detailAnagrafica/CuIrapNoncu") !== "0")
						oData.results.unshift({CodiceNoipa: "", DescNoipa: "", CuIrapNonCu: "0"})
					modelPosFin.setProperty("/formPosFin/Noipa", oData.results)
				}
			})
		},
		onPressConfPosFin: function () {
			if(!this.oDialogTabPosFinanziaria) {
				Fragment.load({
					name:"zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.TablePosizioneFinanziaria",
					controller: this
				}).then(oDialog => {
					this.oDialogTabPosFinanziaria = oDialog;
					this.getView().addDependent(oDialog);
					this.oDialogTabPosFinanziaria.open();
				})
			} else {
				this.oDialogTabPosFinanziaria.open();
			}
		},
		handleCloseFinan: function (oEvent) {
			let homeModel = this.getOwnerComponent().getModel("modelHome")
			let oSelectedItem = homeModel.getProperty(oEvent.getParameter("selectedItem").getBindingContextPath())
			homeModel.setProperty("/posFin", oSelectedItem.POSIZIONE_FINANZIARIA)
			homeModel.setProperty("/selectedPosFin", oSelectedItem)
			this.oDialogPosFin.close()
		},
		onGestisciPosFin: function (oEvent) {
			let homeModel = this.getOwnerComponent().getModel("modelHome")
			this.getView().byId("DetailInitial").setVisible(false)
			homeModel.setProperty("/onAvvio", true)
			homeModel.setProperty("/tabAnagrafica", true)
			homeModel.setProperty("/faseRicerca", false)
			homeModel.setProperty("/onModify", true)
			homeModel.setProperty("/onCreate", false)
			homeModel.setProperty("/detailAnagrafica", homeModel.getProperty("/selectedPosFin"))
			this.getView().byId("idCompetenzaTab").setVisible(true)
			this.getView().byId("idCassTab").setVisible(true)

			//lt chiudo il popup
			this.handlecloseInizialFilter();

		},
		onCreaPosFin: function(oEvent){
			let homeModel = this.getOwnerComponent().getModel("modelHome")
			this.getView().byId("DetailInitial").setVisible(false)
			homeModel.setProperty("/onAvvio", true)
			homeModel.setProperty("/tabAnagrafica", true)
			homeModel.setProperty("/onModify", false)
			homeModel.setProperty("/onCreate", true)
			homeModel.setProperty("/detailAnagrafica", {})
			this.getView().byId("idCompetenzaTab").setVisible(false)
			this.getView().byId("idCassTab").setVisible(false)

			//lt chiudo il popup
			this.handlecloseInizialFilter();
		},
		onExpandPopOverPosFin: function (oEvent) {
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
				oPopover.openBy(oButton);
			});
		},
		onExpandPopOverDettStruttCentr: function (oEvent) {
			var oButton = oEvent.getSource(),
			oView = this.getView();

			if (!this._pPopoverStruttAmmCentr) {
				this._pPopoverStruttAmmCentr = Fragment.load({
					id: oView.getId(),
					name: "zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.HVPosFin.PopOverStruttAmmCentrale",
					controller: this
				}).then(function(oPopover) {
					oView.addDependent(oPopover);
					return oPopover;
				});
			}
			this._pPopoverStruttAmmCentr.then(function(oPopover) {
				oPopover.openBy(oButton);
			});
		},
		__getStrutturaAmminCentrale: function (oPosFin) {
			let modelPosFin = this.getView().getModel("modelPosFin")
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let aFilters = [	new Filter("Fikrs", FilterOperator.EQ, oPosFin.Fikrs),
								new Filter("Fase", FilterOperator.EQ, oPosFin.Fase),
								new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
								// new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
								new Filter("Eos", FilterOperator.EQ, oPosFin.Eos),
								new Filter("Datbis", FilterOperator.GE,  new Date()),
								new Filter("Prctr", FilterOperator.EQ, oPosFin.Prctr),
								new Filter("CodiceCdr", FilterOperator.EQ, oPosFin.Cdr),
								new Filter("CodiceRagioneria", FilterOperator.EQ, oPosFin.Ragioneria),
								new Filter("CodiceUfficio", FilterOperator.EQ, '0000'),
							]
			if(modelPosFin.getProperty("/infoSottoStrumento/Reale") == "S")
				aFilters.push(new Filter({
					filters: [
								new Filter("Reale", FilterOperator.EQ, "R"),
								new Filter("Reale", FilterOperator.EQ, "S0001")
							],
					and : false
				}))
			else
				aFilters.push(new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")))
			return new Promise( (resolve, reject) => {
				modelHana.read("/StrutturaAmministrativaCentraleSet", {
					filters: aFilters,
					success: (oData) =>  {
						modelPosFin.setProperty("/strutturaAmminCentrale", oData.results[0])
						resolve()
					}
				})
			})
		},
		onPressRipristinaRicerca: function (oEvent) {
			let homeModel = this.getOwnerComponent().getModel("modelHome")
			homeModel.setProperty("/faseRicerca", true)
			this.getView().byId("DetailInitial").setVisible(true)
			homeModel.setProperty("/Sottostrumento", "")
			homeModel.setProperty("/esercizio", "")
			homeModel.setProperty("/posFin", "")
			homeModel.setProperty("/onAvvio", false)
			homeModel.setProperty("/tabAnagrafica", false)

			//lt apro il popup
			this.handleCreateInizialFilter();
			
		},

		//lt button info general
		onExpandPopOverInfo: function (oEvent) {
			var oButton = oEvent.getSource(),			
			oView = this.getView();
			var customData = oButton.data();
			var descrizione,
			title;
			if(!customData.desc || customData.desc === ""){
				descrizione = "no desc";
				//return;
			}else{
				descrizione = customData.desc;
			}	
					
			this.getOwnerComponent().getModel("modelHome").setProperty("/InfoPopoverTitle", customData.title); 
			this.getOwnerComponent().getModel("modelHome").setProperty("/InfoPopover", descrizione); 

			// create popover general	
			if (!this._pPopoverAction) {
				this._pPopoverAction = Fragment.load({
					id: oView.getId(),
					name: "zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.PopOverInfoGeneral",
					controller: this
				}).then(function(oPopover) {
					oView.addDependent(oPopover);
					return oPopover;
				});
			}
			this._pPopoverAction.then(function(oPopover) {
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
		__onGetTipoEsposizione: function (esp) {
			return 'NORMALE'
		},
		onExpandPopOverMiss: function (oEvent) {
			var oButton = oEvent.getSource(),
			oView = this.getView();

			// create popover
			if (!this._pPopoverMiss) {
				this._pPopoverMiss = Fragment.load({
					id: oView.getId(),
					name: "zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.PopOverMissione",
					controller: this
				}).then(function(oPopover) {
					oView.addDependent(oPopover);
					return oPopover;
				});
			}
			this._pPopoverMiss.then(function(oPopover) {
				oPopover.openBy(oButton);
			});
		},
		onExpandPopOverProgr: function (oEvent) {
			var oButton = oEvent.getSource(),
			oView = this.getView();

			// create popover
			if (!this._pPopoverProgr) {
				this._pPopoverProgr = Fragment.load({
					id: oView.getId(),
					name: "zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.PopOverProgramma",
					controller: this
				}).then(function(oPopover) {
					oView.addDependent(oPopover);
					return oPopover;
				});
			}
			this._pPopoverProgr.then(function(oPopover) {
				oPopover.openBy(oButton);
			});
		},

		onExpandPopOverAction: function (oEvent) {
			var oButton = oEvent.getSource(),
			oView = this.getView();

			// create popover
			if (!this._pPopoverAction) {
				this._pPopoverAction = Fragment.load({
					id: oView.getId(),
					name: "zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.PopOverAzione",
					controller: this
				}).then(function(oPopover) {
					oView.addDependent(oPopover);
					return oPopover;
				});
			}
			this._pPopoverAction.then(function(oPopover) {
				oPopover.openBy(oButton);
			});
		},
		onTabChanged: function (oEvent) {
			// let homeModel = this.getView().getModel("modelHome")
			//var modelPosFin = this.getView().getModel("modelPosFin")
			let modelPosFin = this.getView().getModel("modelPosFin")
			this.getView().setModel(new JSONModel({quadroVisible:false}),"modelVisQuadri")
			//this.resetSrc();


			switch (oEvent.getParameter("key")) {
				case "info":
					break;
				case "attachments":
					/* modelPosFin.setProperty("/formAutorizzazione", {})
					modelPosFin.setProperty("/formCodingBlock", {})
					let oCompetenzaSac = this.getView().byId("competenzaSac");
					document.getElementById(oCompetenzaSac.getId()).setAttribute("src", "");
					modelPosFin.setProperty("/tabAnagrafica", false) */
					this.getView().setModel(new JSONModel({quadroVisible:false}),"modelVisQuadri")
					this._resetModelTable()
					break;
				case "people":
					this.getView().setModel(new JSONModel({quadroVisible:false}),"modelVisQuadri")
					this._resetModelTable()
					this.showCassaSAC();
					break;
				case "RimOrizzontali":		
					this.getView().setModel(new JSONModel({quadroVisible:false}),"modelVisQuadri")
					this.getView().setModel(new JSONModel({}),"modelPluri")
					this._resetModelTable()
					break;
			
				default:
					break;
			}

			var boolInfo = true;
			oEvent.getParameter("key") === "info" ? boolInfo = true : boolInfo = false;

			modelPosFin.setProperty("/tabAnagrafica", boolInfo)

			
		},

		_resetModelTable: function (isForExport) {
			const exp = isForExport === true ? "Exp" : ""
			
			if (this.getView().getModel("modelTableSac" + exp)) {
				this.getView().getModel("modelTableSac" + exp).setData([])
			}
			if (this.getView().getModel("modelTableSacCa" + exp)) {
				this.getView().getModel("modelTableSacCa" + exp).setData([])
			}
			if (this.getView().getModel("modelTableSacCaVaRes" + exp)) {
				this.getView().getModel("modelTableSacCaVaRes" + exp).setData([])
			}
			if (this.getView().getModel("modelTableCassa" + exp)) {
				this.getView().getModel("modelTableCassa" + exp).setData([])
			}
			if (this.getView().getModel("modelRes" + exp)) {
				this.getView().getModel("modelRes" + exp).setData([])
			}
			if (this.getView().getModel("modelTableRim" + exp)) {
				this.getView().getModel("modelTableRim" + exp).setData([])
			}
			if (this.getView().getModel("modelTable" + exp)) {
				this.getView().getModel("modelTable" + exp).setData([])
			}
			if (this.getView().getModel("modelTableCompDA" + exp)) {
				this.getView().getModel("modelTableCompDA" + exp).setData([])
			}
			if (this.getView().getModel("modelTableComp" + exp)) {
				this.getView().getModel("modelTableComp" + exp).setData([])
			}
			if (this.getView().getModel("modelTableCassaDA" + exp)) {
				this.getView().getModel("modelTableCassaDA" + exp).setData([])
			}
			if (this.getView().getModel("modelTableRim" + exp)) {
				this.getView().getModel("modelTableRim" + exp).setData([])
			}
		},

		//lt inserisco popup iniziale.
		handleCreateInizialFilter: function (oEvent) {

			this.getOwnerComponent().getModel("modelHome").setProperty("/Filter",{
				nome 		: "",
				esercizio 	: "2023",
				descrizione : "",
				statoWf		: "Iniziato"
			})
			if (!this._handleAddFilter) {
				this._handleAddFilter = sap.ui.xmlfragment("zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.FiltriIniziali", this);
				this.getView().addDependent(this._handleAddFilter);
			}
			this._handleAddFilter.open();
		},
		//lt chiudo e distruggo i filtri iniziale
		handlecloseInizialFilter: function () {
			if (this._handleAddFilter) {
				this._handleAddFilter.destroy();
				this._handleAddFilter = null;
			}
		},
		handleAddElencoOBB: async function (campoDaControllare) {
			let modelPosFin = this.getView().getModel("modelPosFin")
			var dElencoA020 = await this.searchA020();
			let aElenchi = modelPosFin.getProperty("/detailAnagrafica/elenchiCapitolo")
			var detailAnagrafica = modelPosFin.getProperty("/detailAnagrafica")

			aElenchi.push({
				PrctrElenco: "A020",
				NumeroElenco: "001",
				Desc: dElencoA020,
				Pg: campoDaControllare === "tipoSpesaCapitolo" ? "00" : detailAnagrafica.pg
			})

			modelPosFin.setProperty("/detailAnagrafica/elenchiCapitolo", aElenchi)
		},

		handleAddElenco: function (oEvent) {
			let modelPosFin = this.getView().getModel("modelPosFin")
			this.__setBusyHelp(modelPosFin, true)
			modelPosFin.setProperty("/codiceElenco", null)
			modelPosFin.setProperty("/descElenco", null)
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let aFilters =  [
				new Filter("Fikrs", FilterOperator.EQ, "S001"),
				new Filter("Fase", FilterOperator.EQ, "NV"),
				new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
				// new Filter("Reale", FilterOperator.EQ,  modelPosFin.getProperty("/infoSottoStrumento/Reale")),
				new Filter("Prctr", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE")),
				
			]
			if(modelPosFin.getProperty("/infoSottoStrumento/Reale") == "S")
				aFilters.push(new Filter({
					filters: [
								new Filter("Reale", FilterOperator.EQ, "R"),
								new Filter("Reale", FilterOperator.EQ, "S0001")
							],
					and : false
				}))
			else
				aFilters.push(new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")))

			if(modelPosFin.getProperty("/detailAnagrafica/elenchiCapitolo").length > 0) {
				// aFilters.push(new Filter({
				// 	filters: modelPosFin.getProperty("/detailAnagrafica/elenchiCapitolo").map(el => new Filter("NumeroElenco", FilterOperator.NE, el.NumeroElenco)),
				// 	and: true,
				//   })
				// )
				modelPosFin.getProperty("/detailAnagrafica/elenchiCapitolo").map(el => aFilters.push(new Filter("NumeroElenco", FilterOperator.NE, el.NumeroElenco)))
			}
			modelHana.read("/ElencoSet", {
				filters: aFilters, 
				success:  (oData) => {
					//oData.results = oData.results.filter(item => !(item.Prctr === "A020" && item.NumeroElenco === "1"))
					let aShowCapElenchi = []
					oData.results = oData.results.filter(el => !(el.Prctr === "A020" && el.NumeroElenco === "001"))
					for(let i = 0 ; i < oData.results.length; i++){
						if(!modelPosFin.getProperty("/detailAnagrafica/elenchiCapitolo").find(el => oData.results[i].NumeroElenco === el.NumeroElenco)){
							aShowCapElenchi.push(oData.results[i])
						}
					}
					modelPosFin.setProperty("/formPosFin/codice_elenco", aShowCapElenchi)
					this.__setBusyHelp(modelPosFin, false)
				}
			})
			if (!this._handleAddElenco) {
				this._handleAddElenco = sap.ui.xmlfragment("zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.HVPosFin.AddElenco", this);
				this.getView().addDependent(this._handleAddElenco);
			}
			this._handleAddElenco.open();
		},

		handlecloseElenco: function () {
			if (this._handleAddElenco) {
				this._handleAddElenco.destroy();
				this._handleAddElenco = null;
			}
		},

		addElenco: function () {
			let modelPosFin = this.getView().getModel("modelPosFin")
			let aElenchi = modelPosFin.getProperty("/detailAnagrafica/elenchiCapitolo")
			//if(modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE") && modelPosFin.getProperty("/codiceElenco") && modelPosFin.getProperty("/descElenco")) {
				aElenchi.push({
					PrctrElenco: modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE"),
					NumeroElenco: modelPosFin.getProperty("/codiceElenco"),
					Desc: modelPosFin.getProperty("/descElenco"),
					Pg: "00"
				})
				modelPosFin.setProperty("/detailAnagrafica/elenchiCapitolo", aElenchi)
			//}
			this.handlecloseElenco();
		},
		onDeleteElenco: function (oEvent) {
			let modelPosFin = this.getView().getModel("modelPosFin")
			let aElenchi = modelPosFin.getProperty("/detailAnagrafica/elenchiCapitolo")
			let sPathToDelete = oEvent.getSource().getParent().getBindingContextPath()
			let sIndex = sPathToDelete.split("/")[sPathToDelete.split("/").length - 1]
			aElenchi.splice( Number(sIndex), 1)
			modelPosFin.setProperty("/detailAnagrafica/elenchiCapitolo", aElenchi)
		},
		onDeleteElencoObb: function (oEvent) {
			let modelPosFin = this.getView().getModel("modelPosFin")			
			let aElenchi = modelPosFin.getProperty("/detailAnagrafica/elenchiCapitolo")
			const elenchi = aElenchi.filter(el => el.PrctrElenco !== "A020" && el.NumeroElenco !== "001")
			modelPosFin.setProperty("/detailAnagrafica/elenchiCapitolo", elenchi)
		},
		handleAddCOFOG: function (oEvent) {
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getView().getModel("modelPosFin")
			this.__setBusyHelp(modelPosFin, true)
			modelPosFin.setProperty("/detailAnagrafica/lista_cofog", [])
			modelPosFin.setProperty("/add_lv1_cofog", null)
			modelPosFin.setProperty("/add_lv2_cofog", null)
			modelPosFin.setProperty("/add_lv3_cofog", null)
			modelPosFin.setProperty("/add_desc_cofog", null)
			modelPosFin.setProperty("/add_percent_cofog", null)

			let aFilters =  [
				new Filter("Fikrs", FilterOperator.EQ, "S001"),
				new Filter("Fase", FilterOperator.EQ, "NV"),
				new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
				// new Filter("Reale", FilterOperator.EQ,  modelPosFin.getProperty("/infoSottoStrumento/Reale")),
				new Filter("Prctr", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE"))
			]

			if(modelPosFin.getProperty("/infoSottoStrumento/Reale") == "S")
				aFilters.push(new Filter({
					filters: [
								new Filter("Reale", FilterOperator.EQ, "R"),
								new Filter("Reale", FilterOperator.EQ, "S0001")
							],
					and : false
				}))
			else
				aFilters.push(new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")))

			modelHana.read("/CofogSet", {
				filters: aFilters, 
				success:  (oData) => {
					modelPosFin.setProperty("/detailAnagrafica/lista_cofog", oData.results)
					this.__setBusyHelp(modelPosFin, false)
				}
			})
			if (!this._handleAddCOFOG) {
				this._handleAddCOFOG = sap.ui.xmlfragment("zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.HVPosFin.AddCOFOG", this);
				this.getView().addDependent(this._handleAddCOFOG);
			}
			this._handleAddCOFOG.open();
		},
		onOpenSearchHVCofog: function (oEvent) {
			if(!this.HVCofog) {
				Fragment.load({
					name:"zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.HVPosFin.HVCofog",
					controller: this
				}).then(oDialog => {
					this.HVCofog = oDialog;
					this.getView().addDependent(oDialog);
					this.HVCofog.open();
				})
			} else {
				this.HVCofog.open();
			}
		},
		handlecloseCOFOG: function () {
			if (this._handleAddCOFOG) {
				this._handleAddCOFOG.destroy();
				this._handleAddCOFOG = null;
			}
		},

		addCOFOG: function () {
			let modelPosFin = this.getView().getModel("modelPosFin")
			let aCofog = modelPosFin.getProperty("/detailAnagrafica/elencoCOFOG")
			if(modelPosFin.getProperty("/add_lv1_cofog") && modelPosFin.getProperty("/add_lv2_cofog") && modelPosFin.getProperty("/add_lv3_cofog")
					&& modelPosFin.getProperty("/add_desc_cofog") && modelPosFin.getProperty("/add_percent_cofog")) {
				aCofog.push({
					CofogL1: modelPosFin.getProperty("/add_lv1_cofog"),
					CofogL2: modelPosFin.getProperty("/add_lv2_cofog"),
					CofogL3: modelPosFin.getProperty("/add_lv3_cofog"),
					Desc: modelPosFin.getProperty("/add_desc_cofog"),
					PercCofog: modelPosFin.getProperty("/add_percent_cofog")
				})
				modelPosFin.setProperty("/detailAnagrafica/elencoCOFOG", aCofog)
			}
			this.handlecloseCOFOG();
		},
		onDeleteCofog: function (oEvent) {
			let modelPosFin = this.getView().getModel("modelPosFin")
			let aCofog = modelPosFin.getProperty("/detailAnagrafica/elencoCOFOG")
			let sPathToDelete = oEvent.getSource().getParent().getBindingContextPath()
			let sIndex = sPathToDelete.split("/")[sPathToDelete.split("/").length - 1]
			aCofog.splice( Number(sIndex), 1)
			modelPosFin.setProperty("/detailAnagrafica/elencoCOFOG", aCofog)
		},
		onOpenSearchCOFOG: function (oEvent) {

			
			if (!this._handleAddCOFOG) {
				this._handleAddCOFOG = sap.ui.xmlfragment("zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.AddCOFOG", this);
				this.getView().addDependent(this._handleAddCOFOG);
			}
			this._handleAddCOFOG.open();
		},


		initData: function () {

			//sap.ui.core.BusyIndicator.show();		
			var sapHanaS2Tipologiche = this.getOwnerComponent().getModel("sapHanaS2Tipologiche");

			var scpDeferredGroups = sapHanaS2Tipologiche.getDeferredGroups();
			scpDeferredGroups = scpDeferredGroups.concat(["scpGroup"]);
			sapHanaS2Tipologiche.setDeferredGroups(scpDeferredGroups);
			var that = this;
			var entityArray = [
				"/ZES_AMMINISTRAZIONE_SET",
				"/ZES_PROGRAMMA_SET",
				"/ZES_CATEGORIA_SET",
				"/ZES_AZIONE_SET",
				"/ZES_MISSIONE_SET",
				"/ZES_ECONOMICA2_SET",
				"/ZES_ECONOMICA3_SET"/* ,
				"/ZES_PG_SET",
				"/ZES_CAPITOLO_SET"	 */			
			];
			
			for (var i=0; i<entityArray.length; i++) {
				var entity = entityArray[i];
				var urlParam = {};
				sapHanaS2Tipologiche.read(entity,	  {groupId: "scpGroup", urlParameters: urlParam });
        	}
        	
			

			sapHanaS2Tipologiche.submitChanges({
				success: function (batchCallRel) {
					var errore = false;
					for (var j = 0; batchCallRel.__batchResponses && j < batchCallRel.__batchResponses.length; j++) {
						if (batchCallRel.__batchResponses[j].statusCode === "200") {
							var propertyToSave = this[j];				
							that.getOwnerComponent().getModel("modelHome").setProperty(propertyToSave, batchCallRel.__batchResponses[j].data.results);
							
						} 
					}
					if(errore){
							sap.ui.core.BusyIndicator.hide();
							MessageBox.error("Errore recupero di alcune entities");
							return;
					}
					sap.ui.core.BusyIndicator.hide();
				}.bind(entityArray),
				error: function (oError) {
					sap.ui.core.BusyIndicator.hide();
					MessageBox.error(that.getView().getModel("i18n").getResourceBundle().getText("errorChiamataBatchInit"));
					return;
				}.bind(entityArray)
			});

		},
		onNavBack: function () {		
			var oHistory = History.getInstance();
			var sPreviousHash = oHistory.getPreviousHash();

			if (sPreviousHash !== undefined) {
				window.history.go(-1);
			} else {
				var oRouter = this.getOwnerComponent().getRouter();
				oRouter.navTo("", {}, true);
			}
					
		},
		onExit: function() {
			//debugger
			var that = this;
			var sModelRecord = this.getOwnerComponent().getModel("modelLockRecord").getData();
				jQuery.sap.delayedCall(1000, this, function() {
					if(that.unlock) that.unLockPosFin(sModelRecord);
				});
			},
		onNavToHome: async function () {		
      if(this.unlock) await this.unLockPosFin();	
			console.log(`Navigo verso la home unlock è: ${this.unlock} `);
			var oHistory = History.getInstance();
			var oRouter = this.getOwnerComponent().getRouter();
			oRouter.navTo("Home");			
					
		},
		onReimpostaPosFin: async function () {
      if(this.unlock) await this.unLockPosFin()
			console.log(`Navigo verso la homePosFin unlock è: ${this.unlock} `);
			const oRouter = this.getOwnerComponent().getRouter()
			const modelPosFin = this.getView().getModel("modelPosFin")
			oRouter.navTo("HomePosFin", {
				Fikrs: modelPosFin.getProperty("/infoSottoStrumento/Fikrs"),
				CodiceStrumento: modelPosFin.getProperty("/infoSottoStrumento/CodiceStrumento"),
				CodiceStrumentoOri: modelPosFin.getProperty("/infoSottoStrumento/CodiceStrumentoOri"),
				CodiceSottostrumento: modelPosFin.getProperty("/infoSottoStrumento/CodiceSottostrumento"),
				Datbis: modelPosFin.getProperty("/infoSottoStrumento/Datbis").toISOString(),
			});	
		},
		onAuth: async function  (oEvent) {
			const modelPosFin = this.getView().getModel("modelPosFin")
			const annoFormazione = this.getOwnerComponent().getModel("globalModel").getProperty("/ANNO")
			modelPosFin.setProperty("/dispAnnoFaseLabel", `Disponibilità ${parseInt(annoFormazione)}`)
			modelPosFin.setProperty("/dispAnnoPlusOneLabel", `Disponibilità ${parseInt(annoFormazione) + 1}`)
			modelPosFin.setProperty("/dispAnnoPlusTwoLabel",`Disponibilità ${parseInt(annoFormazione) + 2}`)
			modelPosFin.setProperty("/busyAuth", true)
			modelPosFin.setProperty("/elencoAuth", [])
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
		onOpenFormRicercaAuth: function (oEvent) {
			const modelPosFin = this.getView().getModel("modelPosFin")
			modelPosFin.setProperty("/formAutorizzazione/Item", {});

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
		__getAuthorizzazioni: function () {
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getView().getModel("modelPosFin")
			let aFilters = [
				new Filter("Fikrs", FilterOperator.EQ, modelPosFin.getProperty("/PosFin/Fikrs")),
				new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/PosFin/Anno")),
				new Filter("Fase", FilterOperator.EQ,modelPosFin.getProperty("/PosFin/Fase")),
				new Filter("Reale", FilterOperator.EQ,modelPosFin.getProperty("/PosFin/Reale")),
				//new Filter("Versione", FilterOperator.EQ,modelPosFin.getProperty("/PosFin/Versione")),
				new Filter("Fipex", FilterOperator.EQ,modelPosFin.getProperty("/PosFin/Fipex")),
				//new Filter("Classificazione", FilterOperator.NE, "E")
			]
			//if(modelPosFin.getProperty("/infoSottoStrumento/TipoEsposizione") === '2')
			if(modelPosFin.getProperty("/infoSottoStrumento/TipoEsposizione") === '1')
				aFilters.push(new Filter("Classificazione", FilterOperator.EQ, "FL"))
			else 
				aFilters.push(new Filter("Classificazione", FilterOperator.NE, "E"))
				
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
		__getLabels: function () {
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getView().getModel("modelPosFin")

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
		__getAuthCollegata: function () {
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getView().getModel("modelPosFin")
			modelPosFin.setProperty("/busyAuth", true)
			let aFilters = [
				new Filter("SeqFondo", FilterOperator.EQ, modelPosFin.getProperty("/CompetenzaAuth/Auth/IdAutorizzazione"))
			]
			modelHana.read("/AutorizzazioneCollegataSet",{
				filters: aFilters,
				success: (oData) =>{
					//debugger
					let results = []
					for(let i = 0; i <  oData.results.length; i++){
						if(results.filter(item => (item.SeqFondo === oData.results[i].SeqFondo && 
							item.SeqFondoLe === oData.results[i].SeqFondoLe &&
							item.TipoLegame === oData.results[i].TipoLegame)).length === 0)
							results.push(oData.results[i])
					}
					modelPosFin.setProperty("/busyAuth", false)
					modelPosFin.setProperty("/elencoAuthCollegata", results)
				},
				error: (res) => {
					//debugger
					modelPosFin.setProperty("/busyAuth", false)
				}
			})
		},
		onAuthCollegata: function (oEvent) {
			this.__getAuthCollegata()
			if(!this.oDialogAutorizzazioniCollegate) {
				Fragment.load({
					name:"zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.HVAuthCollegata",
					controller: this
				}).then(oDialog => {
					this.oDialogAutorizzazioniCollegate = oDialog;
					this.getView().addDependent(oDialog);
					this.oDialogAutorizzazioniCollegate.open();
				})
			} else {
				this.oDialogAutorizzazioniCollegate.open();
			}
		},
		handleConfirmAuth: function (oEvent) {
			let modelHome = this.getView().getModel("modelHome")
			let modelPosFin = this.getView().getModel("modelPosFin")
			let selectedItem = modelPosFin.getProperty(oEvent.getParameter("selectedItem").getBindingContextPath());
			modelPosFin.setProperty("/CompetenzaAuth/AuthAssociata", null)
			modelPosFin.setProperty("/CompetenzaAuth/Auth",selectedItem)
			modelPosFin.setProperty("/CompetenzaAuth/DescrInputAuth",selectedItem.ZzdescrEstesaFm ? selectedItem.ZzdescrEstesaFm : 'NULL')
			//!LT resetto i modelli delle tabelle
			this._resetModelTable()			
		},
		handleConfirmAuthCollegata: function (oEvent) {
			let modelPosFin = this.getView().getModel("modelPosFin")
			let selectedItem = modelPosFin.getProperty(oEvent.getParameter("selectedItem").getBindingContextPath());
			modelPosFin.setProperty("/CompetenzaAuth/AuthAssociata", selectedItem)
			modelPosFin.setProperty("/CompetenzaAuth/DescrInputAuthAssociata", selectedItem.ZzdescrEstesaFm ? selectedItem.ZzdescrEstesaFm : 'NULL')
		},
		onResetAuth: function() {
			let modelPosFin = this.getView().getModel("modelPosFin")
			let maxAuthScadenza = null;
			let minAuthAttivazione = null;
			if(modelPosFin.getProperty("/CompetenzaAuth/MaxAuthScadenza")) maxAuthScadenza = modelPosFin.getProperty("/CompetenzaAuth/MaxAuthScadenza")
			modelPosFin.setProperty("/CompetenzaAuth",{
				AuthAssociata: null,
				Auth: null,
				DescrInputAuth: null,
				MaxAuthScadenza: maxAuthScadenza
			})
			if(modelPosFin.getProperty("/CompetenzaAuth/minAuthAttivazione")) minAuthAttivazione = modelPosFin.getProperty("/CompetenzaAuth/minAuthAttivazione")
			modelPosFin.setProperty("/CompetenzaAuth",{
				AuthAssociata: null,
				Auth: null,
				DescrInputAuth: null,
				minAuthAttivazione : minAuthAttivazione,
			
			})
			this.onResetDati()
			this.getView().getModel("modelVisQuadri").setProperty("/quadroVisible" , false)

		},
		onNuovaAuth: function() {
			let modelPosFin = this.getView().getModel("modelPosFin")
			modelPosFin.setProperty("/formCodingBlock/DescrInputAuth", "")
			modelPosFin.setProperty("/formCodingBlock/nuovaAuth", true)
			modelPosFin.setProperty("/formCodingBlock/Auth", null)
			modelPosFin.setProperty("/formCodingBlock/title", "Crea Coding Block")
			modelPosFin.setProperty("/formCodingBlock/FOP", "")
			modelPosFin.setProperty("/formCodingBlock/checkedPercentAps", false)
			modelPosFin.setProperty("/formCodingBlock/APS", "")
			modelPosFin.setProperty("/formCodingBlock/Tcrc", "")
			modelPosFin.setProperty("/formCodingBlock/Tcrf", "")
			modelPosFin.setProperty("/formCodingBlock/percentQuotaAggredibilita", "")
			this.onOpenFormCodingBlock()
		},
		onChooseNuovaAuth: function(oEvent) {
			let modelHome = this.getOwnerComponent().getModel("modelHome")
			let selectedItem = modelHome.getProperty(oEvent.getParameter("selectedItem").getBindingContextPath());
			modelHome.setProperty("/CompetenzaAuth/Auth", selectedItem.desc)
		},
		onGestisciCodingBlock: async function () {
			this.getView().setBusy(true)
			let modelPosFin = this.getView().getModel("modelPosFin")
			let currentAuth =  modelPosFin.getProperty("/CompetenzaAuth/Auth")

			if(!currentAuth){
				MessageBox.warning(`Per poter gestire il coding block è necessario selezionare un'autorizzazione`);
				this.getView().setBusy(false)
				return;
			}

			let sUrlAuth =  "/" + currentAuth.__metadata.uri.split("/")[currentAuth.__metadata.uri.split("/").length - 1]
			let oAuth = await this.__getKeyPromise(sUrlAuth, this.getOwnerComponent().getModel("sapHanaS2"))
			modelPosFin.setProperty("/formCodingBlock/Auth", oAuth) //modelPosFin.getProperty("/CompetenzaAuth/Auth")
			modelPosFin.setProperty("/formCodingBlock/DescrInputAuth", oAuth.ZzdescrEstesaFm ? oAuth.ZzdescrEstesaFm : 'NULL')
			modelPosFin.setProperty("/formCodingBlock/nuovaAuth", false)
			modelPosFin.setProperty("/formCodingBlock/title", "Gestisci Coding Block")
			modelPosFin.setProperty("/formCodingBlock/FOP", modelPosFin.getProperty("/formCodingBlock/Auth/FondoOpereProgetti"))
			modelPosFin.setProperty("/formCodingBlock/checkedPercentAps", modelPosFin.getProperty("/formCodingBlock/Auth/FlagAiutoPubblicoSviluppo") ? true : false)
			modelPosFin.setProperty("/formCodingBlock/APS", modelPosFin.getProperty("/formCodingBlock/Auth/PercAPS") === "000" ? "" : parseFloat(modelPosFin.getProperty("/formCodingBlock/Auth/PercAPS"),10).toFixed(2))
			modelPosFin.setProperty("/formCodingBlock/Tcrc", parseInt(modelPosFin.getProperty("/formCodingBlock/Auth/TcrC"),10).toString())
			modelPosFin.setProperty("/formCodingBlock/Tcrf", parseInt(modelPosFin.getProperty("/formCodingBlock/Auth/TcrF"),10).toString())
			modelPosFin.setProperty("/formCodingBlock/percentQuotaAggredibilita", parseFloat(modelPosFin.getProperty("/formCodingBlock/Auth/PercQuotaAgg"),10).toFixed(2))
			modelPosFin.updateBindings()
			this.onOpenFormCodingBlock()
			this.getView().setBusy(false)
		},
		onOpenFormCodingBlock: function () {
			var modelPosFin = this.getView().getModel("modelPosFin");
			modelPosFin.setProperty("/formAutorizzazione/Item", {});
			if(!this.FormCodingBlock) {
				Fragment.load({
					name:"zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.FormCodingBlock",
					controller: this
				}).then(oDialog => {
					this.FormCodingBlock = oDialog;
					this.getView().addDependent(oDialog);
					this.FormCodingBlock.open();
				})
			} else {
				this.FormCodingBlock.open();
			}
		},
		resetFiltriCodingBlock: function(){
			let modelPosFin = this.getView().getModel("modelPosFin")
			modelPosFin.setProperty("/formCodingBlock/checkedPercentAps", false)
			modelPosFin.setProperty("/formCodingBlock/APS", "")
			modelPosFin.setProperty("/formCodingBlock/Tcrc", "")
			modelPosFin.setProperty("/formCodingBlock/Tcrf", "")
			modelPosFin.setProperty("/formCodingBlock/percentQuotaAggredibilita", "")
			modelPosFin.setProperty("/formCodingBlock/FOP", "")
			if(modelPosFin.getProperty("/formCodingBlock/nuovaAuth")){
				modelPosFin.setProperty("/formCodingBlock/Auth", null)
				modelPosFin.setProperty("/formCodingBlock/DescrInputAuth", null)
			}
		},
		checkModifiableValue: function () {
			let bCheck = true
			const modelPosFin = this.getView().getModel("modelPosFin")
			if(modelPosFin.getProperty("/onModify")){
				if(modelPosFin.getProperty("/infoSottoStrumento/TipoEsposizione") === '2'){
					bCheck = false
				}
			}
			return bCheck
		},
		checkModifiyDenominazioneIntegraleCapitolo: function (oEvent) {
			let bCheck = true
			const modelPosFin = this.getView().getModel("modelPosFin")
			if(!modelPosFin.getProperty("/onModify")){ //modifica
				if(modelPosFin.getProperty("/detailAnagrafica/CODICE_STANDARD_CAPITOLO")){
					bCheck = false
				}
			} else {
				if(modelPosFin.getProperty("/detailAnagrafica/CODICE_STANDARD_CAPITOLO")) {
					bCheck = false
				}
			}
			return bCheck
		},
		checkModifiyDenominazioneBreveCapitolo: function(){
			let bCheck = true
			const modelPosFin = this.getView().getModel("modelPosFin")
			if(modelPosFin.getProperty("/onModify")){
				if(modelPosFin.getProperty("/infoSottoStrumento/TipoEsposizione") === '2'){
					bCheck = false
				}
				if(modelPosFin.getProperty("/detailAnagrafica/CODICE_STANDARD_CAPITOLO")) {
					bCheck = false
				}
			} else {
				if(modelPosFin.getProperty("/detailAnagrafica/CODICE_STANDARD_CAPITOLO")){
					bCheck = false
				}
			}
			return bCheck
		},
		checkModifiyDenominazioneIntegralePG: function (oEvent) {
			let bCheck = true
			const modelPosFin = this.getView().getModel("modelPosFin")
			if(!modelPosFin.getProperty("/onModify")){ //modifica
				if(modelPosFin.getProperty("/detailAnagrafica/CODICE_STANDARD_PG")){
					bCheck = false
				}
			} else {
				if(modelPosFin.getProperty("/detailAnagrafica/CODICE_STANDARD_PG")) {
					bCheck = false
				}
			}
			return bCheck
		},
		checkModifiyDenominazioneBrevePG: function(){
			let bCheck = true
			const modelPosFin = this.getView().getModel("modelPosFin")
			if(modelPosFin.getProperty("/onModify")){
				if(modelPosFin.getProperty("/infoSottoStrumento/TipoEsposizione") === '2'){
					bCheck = false
				}
				if(modelPosFin.getProperty("/detailAnagrafica/CODICE_STANDARD_PG")) {
					bCheck = false
				}
			} else {
				if(modelPosFin.getProperty("/detailAnagrafica/CODICE_STANDARD_PG")){
					bCheck = false
				}
			}
			return bCheck
		},
		showCassaSAC: async function (oEvent,isForExport) {
			
			this.getView().setModel(new JSONModel({}),"modelPluri")
			const exp = isForExport === true ? "Exp" : ""
			this.getView().setBusy(true);
			this.getView().setModel(new JSONModel([{}]), `modelTableCassa${exp}`);
			const oModelQuadro = this.getOwnerComponent().getModel("ZSS4_COBI_QUADRO_CONTABILE_SRV")
			let oModelPosFin = this.getView().getModel("modelPosFin");
			//lt regolo visibilità dei quadri in modo semplice
			if(!isForExport){
				const modelVisQuadri = this.getView().getModel("modelVisQuadri")
				const modelLocked = this.getView().getModel("modelLocked")
				const edit = oModelPosFin.getProperty('/gestioneCampiEditabili/quadri')
				const statusPg = oModelPosFin.getProperty('/PosFin/StatusPg')
				const statusCapitolo = oModelPosFin.getProperty('/PosFin/StatusCapitolo')
				const isLocked = modelLocked.getProperty("/LOCKED")
				let quadroVisibile = false
				if(statusCapitolo !== '3' && statusPg !== '3' && edit && isLocked === ''){
					quadroVisibile = true
				}
				modelVisQuadri.setProperty('/Attivo' , quadroVisibile)

			}
			let sAnno = this.getOwnerComponent().getModel("globalModel").getData().ANNO;
			this.popolateModelFilter();
			var modelFilter = this.getView().getModel("modelFilter").getData();
			var sEntity = "/QuadroContabile(P_Disp=true,P_AreaFin='S001',P_AnnoFase='" + sAnno + "',P_AnnoMin='" + sAnno + "',P_AnnoMax='" + (parseInt(sAnno) + 2) + "',P_Fase='NV',P_Eos='S',P_PosFin='" + modelFilter.posfin + "',P_Autorizz='SYSTSPESE',P_Capitolo='" + oModelPosFin.getProperty("/PosFin/Capitolo") + "',P_RecordType='OP')/Set"
			var aRes = await this.__getDataPromise(sEntity, [], oModelQuadro);
			this.formatterImporti(aRes, true)

			this.splitTable(aRes, "CASSA", `modelTableCassa`,isForExport);
			this.getView().setModel(new JSONModel([]), "modelAppoggio");
			this.setModelSelect();
			this.setModelTableSac(null,"Ca", isForExport);
			this.getView().setModel(new JSONModel([]), "modelAppoggio");
			this.setModelTableResidui();

			var sEntityDA = "/ZCOBI_I_QC_DAL_AL(P_AnnoFase='" + sAnno + "',P_AnnoStr='" + sAnno + "',P_AnnoSstr='" + (parseInt(sAnno) + 2) + "',P_PosFin='" + modelFilter.posfin + "',P_Autorizz='" + "',P_StruttAmm='" +  oModelPosFin.getProperty('/strutturaAmminCentrale/Fictr') + "')/Set";
			var aFilters = [];
			aFilters.push(new sap.ui.model.Filter("RecordType", sap.ui.model.FilterOperator.EQ, "CS"));
			var aRes = await this.__getDataPromise(sEntityDA, aFilters, oModelQuadro);
			this.formatterImporti(aRes, false, "Importo")
			aRes = aRes.sort(
				(a, b) => parseInt(a.YearLow) - parseInt(b.YearLow)
			);
			this.getView().setModel(new JSONModel(aRes), `modelTableCassaDA${exp}`);

			this.getView().setBusy(false)
		},
		showCompetenzaSAC: async function (oEvent,isForExport) {
			//this.getView().setModel(new JSONModel({}),"modelPluri")
			this.popolateModelFilter();
			let oModelPosFin = this.getView().getModel("modelPosFin");
			var modelFilter = this.getView().getModel("modelFilter").getData();
			if(!isForExport){
				this.getView().setModel(new JSONModel({}),"modelPluri")
				this.getView().setBusy(true)
				let datiPerControllo = this.getView().getModel("modelPosFin").getProperty("/PosFin")
				const oModelVarCont = this.getOwnerComponent().getModel("modemVarCont")
				const struttura = this.getView().getModel("modelPosFin").getProperty("/strutturaAmminCentrale")
				
				var controlloAutorizzazione = false
				var controllo = {
					"Fincode" : modelFilter.fincode,
					"IDcontrollo" : "00005",
					"TypeKey" : "GEST_POSFIN",
					"Fikrs" : "S001",
					"CodiceStrumento" : modelFilter.strumento,
					"CodiceSottostrumento" : modelFilter.sStrumento,
					"CodiceStrumentoori" : modelFilter.strumentoOr,
					"Schermata" : "COMPETENZA",
					"Ambito" : "SPESA",
					"VERSIONE" : datiPerControllo.Versione,
					"ANNO" : datiPerControllo.Anno,
					"REALE" : datiPerControllo.Reale,
					"FIPEX" : datiPerControllo.Fipex,
					"FICTR" : struttura.Fictr 
				}
				var invio  = await this.__setDataPromiseSaveBW( "/Controllo_FLSet" ,oModelVarCont, {}, controllo)
				
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
					this.getView().setBusy(true)
				}
				
					const modelVisQuadri = this.getView().getModel("modelVisQuadri")
					const modelLocked = this.getView().getModel("modelLocked")
					const edit = oModelPosFin.getProperty('/gestioneCampiEditabili/quadri')
					const statusPg = oModelPosFin.getProperty('/PosFin/StatusPg')
					const statusCapitolo = oModelPosFin.getProperty('/PosFin/StatusCapitolo')
					const isLocked = modelLocked.getProperty("/LOCKED")
					let quadroVisibile = false
					if(statusCapitolo !== '3' && statusPg !== '3' && edit && isLocked === ''){
						quadroVisibile = true
					}
					modelVisQuadri.setProperty('/Attivo' , quadroVisibile)
	
				
					this.getView().getModel("modelVisQuadri").setProperty("/OkAuth", controlloAutorizzazione)
			}
				
			this.getView().setModel(new JSONModel({}),"modelPluri")
			const exp = isForExport === true ? "Exp" : ""
			this.getView().setBusy(true)
			let that = this;
			let aAttivoFl = "1"
			//lt controllo prima che l'autorizzazione ci sia
			
			const oModelRuolo = this.getOwnerComponent().getModel("userRoleModel")
			const oModelHana = this.getOwnerComponent().getModel("sapHanaS2")
			/* const sRuolo = oModelRuolo.getProperty("/role/0")

			let oAut = oModelPosFin.getProperty("/CompetenzaAuth");
			 
			const aCheckRuolo = await this.__getDataPromise("/CHECK_ENTITY_RUOLOSet",
								[
									new Filter("Attore", FilterOperator.EQ, sRuolo),
									new Filter("IdControllo", FilterOperator.EQ, "00005"),
									new Filter("TypeKey", FilterOperator.EQ, "GEST_POSFIN"),
									new Filter("Ambito", FilterOperator.EQ, "SPESA"),
									new Filter("Schermata", FilterOperator.EQ, "COMPETENZA")
							], oModelHana)
			// LT DECOMMENTARE QUANDO LA SI VUOLE USARE
			if(aCheckRuolo.length > 0) {
				if(oAut.Auth && oAut.Auth.Classificazione === "FL" && aCheckRuolo[0].AttDisattivo == 'X'){
					MessageBox.warning(aCheckRuolo[0].Operazione) //"Autorizzazione Classificata di Fattore Legislativo. Operare con Rimodulazioni."
					aAttivoFl = "0"
				}
			} else {
				if(oAut.Auth && oAut.Auth.Classificazione === "FL"){
					MessageBox.warning("NON SONO CONSENTITE VARIAZIONI SU AUTORIZZAZIONI DI TIPO FL SENZA INDICARE LA FACOLTÀ DI FLESSIBILITÀ") //"Autorizzazione Classificata di Fattore Legislativo. Operare con Rimodulazioni."
					aAttivoFl = "0"
				}
			} */

			/* this.popolateModelFilter();
			var modelFilter = this.getView().getModel("modelFilter").getData(); */
			const oModelQuadro = this.getOwnerComponent().getModel("ZSS4_COBI_QUADRO_CONTABILE_SRV")
			let sAnno = this.getOwnerComponent().getModel("globalModel").getData().ANNO;
			var sEntity =
				`/QuadroContabile(P_Disp=true,P_AreaFin='S001',P_AnnoFase='${modelFilter.keyAnno}',P_AnnoMin='${modelFilter.keyAnno}',P_AnnoMax='${modelFilter.keyAnno + 2}',P_Fase='NV',P_Eos='S',P_PosFin='${modelFilter.posfin}',P_Autorizz='${modelFilter.fincode}',P_Capitolo='${modelFilter.codCap}',P_RecordType='CB')/Set`;
			var aRes = await this.__getDataPromise(sEntity, [], oModelQuadro);
			this.formatterImporti(aRes, true)
			this.splitTable(aRes, "COMP", `modelTable`, isForExport);
			this.getView().setModel(new JSONModel([]), `modelAppoggio`);
			this.setModelSelect();
			this.setModelTableSac(null,false,isForExport);
			this.setModelTableResidui();

			this.getView().setModel(new JSONModel([]), "modelAppoggio");
			
			//this.byId("toolbarQuadro").setVisible(true);
			var sEntityDA = "/ZCOBI_I_QC_DAL_AL(P_AnnoFase='" + sAnno + "',P_AnnoStr='" + sAnno + "',P_AnnoSstr='" + (parseInt(sAnno) + 2) + "',P_PosFin='" + modelFilter.posfin + "',P_Autorizz='" + modelFilter.fincode + "',P_StruttAmm='" + modelFilter.struttAmm + "')/Set";
			var aFilters = [];
			aFilters.push(new sap.ui.model.Filter("RecordType", sap.ui.model.FilterOperator.EQ, "CP"));
			var aRes = await this.__getDataPromise(sEntityDA, aFilters, oModelQuadro);
			this.formatterImporti(aRes, false, "Importo")
			//! allineo gli importi
			aRes = aRes.sort(
				(a, b) => parseInt(a.YearLow) - parseInt(b.YearLow)
			);
			this.getView().setModel(new JSONModel(aRes), `modelTableComp${exp}`);
			
			this.getView().setBusy(false)
			if(!isForExport){
				this.getView().getModel("modelVisQuadri").setProperty("/quadroVisible" , true)
			}
		},
		showRimOrizzSAC: async function (oEvent, isRimodulazioni, isForExport) {
			this.getView().setModel(new JSONModel({}),"modelPluri")
			this.getView().setBusy(true)
			let that = this;
			let aAttivoFl = "1"
			//lt controllo prima che l'autorizzazione ci sia
			let oModelPosFin = this.getView().getModel("modelPosFin");
			if(!isForExport){
				const modelVisQuadri = this.getView().getModel("modelVisQuadri")
				const modelLocked = this.getView().getModel("modelLocked")
				const edit = oModelPosFin.getProperty('/gestioneCampiEditabili/quadri')
				const statusPg = oModelPosFin.getProperty('/PosFin/StatusPg')
				const statusCapitolo = oModelPosFin.getProperty('/PosFin/StatusCapitolo')
				const isLocked = modelLocked.getProperty("/LOCKED")
				let quadroVisibile = false
				if(statusCapitolo !== '3' && statusPg !== '3' && edit && isLocked === ''){
					quadroVisibile = true
				}
				modelVisQuadri.setProperty('/Attivo' , quadroVisibile)

			}
			const oModelRuolo = this.getOwnerComponent().getModel("userRoleModel")
			const oModelHana = this.getOwnerComponent().getModel("sapHanaS2")
			/* const sRuolo = oModelRuolo.getProperty("/role/0")

			let oAut = oModelPosFin.getProperty("/CompetenzaAuth");
			 
			const aCheckRuolo = await this.__getDataPromise("/CHECK_ENTITY_RUOLOSet",
								[
									new Filter("Attore", FilterOperator.EQ, sRuolo),
									new Filter("IdControllo", FilterOperator.EQ, "00005"),
									new Filter("TypeKey", FilterOperator.EQ, "GEST_POSFIN"),
									new Filter("Ambito", FilterOperator.EQ, "SPESA"),
									new Filter("Schermata", FilterOperator.EQ, "COMPETENZA")
							], oModelHana)
			// LT DECOMMENTARE QUANDO LA SI VUOLE USARE
			if(aCheckRuolo.length > 0) {
				if(oAut.Auth && oAut.Auth.Classificazione === "FL" && aCheckRuolo[0].AttDisattivo == 'X'){
					MessageBox.warning(aCheckRuolo[0].Operazione) //"Autorizzazione Classificata di Fattore Legislativo. Operare con Rimodulazioni."
					aAttivoFl = "0"
				}
			} else {
				if(oAut.Auth && oAut.Auth.Classificazione === "FL"){
					MessageBox.warning("NON SONO CONSENTITE VARIAZIONI SU AUTORIZZAZIONI DI TIPO FL SENZA INDICARE LA FACOLTÀ DI FLESSIBILITÀ") //"Autorizzazione Classificata di Fattore Legislativo. Operare con Rimodulazioni."
					aAttivoFl = "0"
				}
			} */
			if(isRimodulazioni) 
			this.popolateModelFilter();
			var modelFilter = this.getView().getModel("modelFilter").getData();
			const oModelQuadro = this.getOwnerComponent().getModel("ZSS4_COBI_QUADRO_CONTABILE_SRV")
			let sAnno = this.getOwnerComponent().getModel("globalModel").getData().ANNO;
			var sEntity =
				`/QuadroContabile(P_Disp=true,P_AreaFin='S001',P_AnnoFase='${modelFilter.keyAnno}',P_AnnoMin='${modelFilter.keyAnno}',P_AnnoMax='${modelFilter.keyAnno + 2}',P_Fase='NV',P_Eos='S',P_PosFin='${modelFilter.posfin}',P_Autorizz='${modelFilter.fincode}',P_Capitolo='${modelFilter.codCap}',P_RecordType='CB')/Set`;
			//var sEntity = "/QuadroContabile(P_Disp=true,P_AreaFin='S001',P_AnnoFase='" + sAnno + "',P_AnnoMin='" + sAnno + "',P_AnnoMax='" + (parseInt(sAnno) + 2) + "',P_Fase='NV',P_Eos='S',P_PosFin='" + oModelPosFin.getProperty("/posFin").replaceAll(".", "") + "',P_Autorizz='" + oAut.Auth.IdAutorizzazione + "',P_Capitolo='" + oModelPosFin.getProperty("/PosFin/Capitolo") + "',P_RecordType='CB')/Set"
			var aRes = await this.__getDataPromise(sEntity, [], oModelQuadro);
			this.formatterImporti(aRes, true)
			this.splitTable(aRes, "COMP", "modelTable");
			this.getView().setModel(new JSONModel([]), "modelAppoggio");
			this.setModelSelect();
			this.setModelTableSac(null,false);
			this.setModelTableResidui();

			this.getView().setModel(new JSONModel([]), "modelAppoggio");
			
			//this.byId("toolbarQuadroRim").setVisible(true);
			var sEntityDA = "/ZCOBI_I_QC_DAL_AL(P_AnnoFase='" + sAnno + "',P_AnnoStr='" + sAnno + "',P_AnnoSstr='" + (parseInt(sAnno) + 2) + "',P_PosFin='" + modelFilter.posfin + "',P_Autorizz='" + modelFilter.fincode + "',P_StruttAmm='" + modelFilter.struttAmm + "')/Set";
			var aFilters = [];
			aFilters.push(new sap.ui.model.Filter("RecordType", sap.ui.model.FilterOperator.EQ, "CP"));
			var aRes = await this.__getDataPromise(sEntityDA, aFilters, oModelQuadro);
			this.formatterImporti(aRes, false, "Importo")
			aRes = aRes.sort(
				(a, b) => parseInt(a.YearLow) - parseInt(b.YearLow)
			);
			this.getView().setModel(new JSONModel(aRes), "modelTableComp");
			
			this.getView().setBusy(false)		
			if(!isForExport){
				this.getView().getModel("modelVisQuadri").setProperty("/quadroVisible" , true)
			}	
		},
		onSaveAnagPosFin: async function (oEvent) {
			this.getView().setBusy(true)
			const modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			const modelPosFin = this.getView().getModel("modelPosFin")
			//Controlli
			let oDetailAnagrafica = modelPosFin.getProperty("/detailAnagrafica")
			let oPosFin = JSON.parse(JSON.stringify(modelPosFin.getProperty("/PosFin")))
			//let oPosFinOri = modelPosFin.getProperty("/PosFin")
			let resultsMessage = null
			// let bCheckPosFinModified = await this.__checkPosFinModified(oPosFin, oDetailAnagrafica)
			// if(!bCheckPosFinModified) {
			// 	this.getView().setBusy(false)
			//  	return 
			// }
			let aCofogOriginali = await this.__getCofogOriginali(oPosFin)
			let aElenchiOriginali = await this.__getElenchiOriginali(oPosFin)
			let bCheckDenomCapitoloPG = await this.__checkDenominazioniCapitoloPGModified(oDetailAnagrafica) //controllo modifica denominazioni capitolo e pg
			let bCheckAttributiCapitoloPosFin = await this.__checkAttributiCapitolo(oDetailAnagrafica, oPosFin) //controllo modifica attributi primari capitolo
			let bCheckAttributiPgPosFin = await this.__checkAttributiPg(oDetailAnagrafica, oPosFin) //controllo modifica attributi primari pg
			let aRelatedPosFin = await this.__getRelatedPosFinByCapitolo(oPosFin)
			let bChoiceSalva = true

			//check somma cofog o almeno una cofog inserita
			const sumCofog = oDetailAnagrafica.elencoCOFOG.reduce((partialSum, a) => partialSum + parseFloat(a.PercCofog, 2), 0)
			if(sumCofog !== parseFloat(100, 2)){
				this.getView().setBusy(false)
				return MessageBox.error(oDetailAnagrafica.elencoCOFOG.length > 0 ? ( oDetailAnagrafica.elencoCOFOG.length === 1 ? "La COFOG deve avere percentuale uguale a 100" : "La somma delle percentuali COFOG è diversa da 100") : "Inserire almeno una COFOG")
			}
			//
			let payload = {}
			let objLogcheck = {}
			objLogcheck = this.__setSStrLog( oDetailAnagrafica, aElenchiOriginali, bCheckDenomCapitoloPG.DenCapitolo, bCheckDenomCapitoloPG.DenPg, aCofogOriginali)
			payload = this.__createPayloadUpdate(oPosFin,oDetailAnagrafica, bCheckDenomCapitoloPG, objLogcheck,aRelatedPosFin, aElenchiOriginali)
			payload.UpdateSstrLog = objLogcheck.tabellaLog
			if(objLogcheck.checkCapitolo === true || bCheckDenomCapitoloPG.resultCapitolo === true ){
				for(let i = 0 ; i < aRelatedPosFin.length ; i++) {
					payload.UpdateRelatedPosfin.push(
						{
							Fikrs: oPosFin.Fikrs,
							Anno: oPosFin.Anno,
							Fase: oPosFin.Fase,
							Reale: oPosFin.Reale,
							Versione: oPosFin.Versione,
							Fipex: oPosFin.Fipex,
							Datbis: new Date(oPosFin.Datbis),
							RelatedFikrs: aRelatedPosFin[i].Fikrs,
							RelatedAnno: aRelatedPosFin[i].Anno,
							RelatedFase: aRelatedPosFin[i].Fase,
							RelatedReale: aRelatedPosFin[i].Reale,
							RelatedVersione: aRelatedPosFin[i].Versione,
							RelatedFipex: aRelatedPosFin[i].Fipex,
							RelatedDatbis: new Date(aRelatedPosFin[i].Datbis),
						}
					)
				}
			}

			modelPosFin.setProperty("/payloadModifica", payload)
			if(objLogcheck.checkCapitolo === true || bCheckDenomCapitoloPG.resultCapitolo === true || bCheckDenomCapitoloPG.resultPg === true || objLogcheck.checkPg === true || objLogcheck.checkCapitolo === true) {
				if((objLogcheck.checkCapitolo === true || bCheckDenomCapitoloPG.resultCapitolo === true) && aRelatedPosFin.length > 0) {
					modelPosFin.setProperty("/posFinUpdate", aRelatedPosFin)
					Fragment.load({
						name:"zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.HVPosFin.ElencoPosFinUpdate",
						controller: this
					}).then(oDialog => {
						this.oDialogUpdate = oDialog;
						this.getView().addDependent(oDialog);
						this.oDialogUpdate.open();
					})
				} else {
					this.__saveModifyPosFin(payload)
				}
			} else {
				this.getView().setBusy(false)
			}
		},
		__getCofogOriginali: function (oPosFin) {
			let modelPosFin = this.getView().getModel("modelPosFin")
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			return new Promise( (resolve, reject) => {
				modelHana.read("/DistribuzioneCofogSet", {
					filters: [new Filter("Fikrs", FilterOperator.EQ, "S001"),
					new Filter("Fase", FilterOperator.EQ, "NV"),
					new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
					new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
					new Filter("Fipex", FilterOperator.EQ, oPosFin.Fipex.replaceAll(".", ""))
				],
				success:  async (oData) =>  {
					resolve(oData.results)
				}
				})	
			})	
		},
		onSaveAnagPosFin2: async function () {
			this.getView().setBusy(true)
			const modelPosFin = this.getView().getModel("modelPosFin")
			const modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			const modelFoglio = this.getOwnerComponent().getModel("sapHanaS2FoglioNotizie")
			const modelAmm = this.getOwnerComponent().getModel("modemAmm")

			const oPosFin = modelPosFin.getProperty("/PosFin")
			const oInfoSottostrumento = modelPosFin.getProperty("/infoSottoStrumento")
			const oDetailAnagrafica = modelPosFin.getProperty("/detailAnagrafica")
			const that = this

			let aFilters = [
				new Filter("FIKRS", FilterOperator.EQ, oPosFin.Fikrs),
				new Filter("FASE", FilterOperator.EQ, oPosFin.Fase),
				new Filter("ANNO", FilterOperator.EQ, oPosFin.Anno),
				new Filter("CODICE_CAPITOLO", FilterOperator.EQ, oPosFin.Capitolo),
				new Filter("REALE", FilterOperator.EQ, oPosFin.Reale),
				new Filter("VERSIONE", FilterOperator.EQ, oPosFin.Versione),
				new Filter("PRCTR", FilterOperator.EQ, oPosFin.Prctr),
				new Filter("FIPEX", FilterOperator.EQ, oPosFin.Fipex)]
			let recPosFin = await that.__getDataPromisePerFoglio("/ZES_POSFIN_SA_SET", aFilters, modelAmm) 
			//!recupero le liste dei menu a tendina
			
			let tipoSpesa = await this.__getDataPromise( "/TipoSpesaSet" , [] , modelHana, {})
			let naturaSpesaSpesa = await this.__getDataPromise( "/NaturaSpesaSet" , [] , modelHana, {})
			let cuIrapNonCuSet = await this.__getDataPromise( "/CuIrapNonCuSet" , [] , modelHana, {})

			const liste = {
				Spesa : tipoSpesa,
				Natura : naturaSpesaSpesa,
				CuIrap : cuIrapNonCuSet
			}
			
			var campiModificati = {
				Amministrazione : false,
				Cdr : false,
				Missione : false,
				Programma : false,
				Azione : false,
				COFOG : false,
				Titolo : false,
				Categoria : false,
				CE2 : false,
				CE3 : false
			}

			if(!this.checkStringifyDetailAnagrafica()) {
				this.getView().setBusy(false)
				return;
			}

			// function pipe
			this.pipeAsync(
				this._checkAperturaLock,
					//this._checkFaseAmminAperta,
					this.__checkObbligatoriValorizzati,
					//this._checkEnableFPFO,
					this.__getPosFinElenchiCofog,
					this.__checkModificaCapitolo,
					this.__checkModificaPG,
					this.__checkChiaviModified,
					this.__checkSumCofog,
					this.__checkFoglioNotizie,
					this.__getRelatedPosFin,
					this.__checkLastPgAttivo,
					this.__setVideoMessage,
					this.__createPayloadModify,
					this.__onSaveModifyToDB,
					this.__setBusyFalse,
					this.__navToPosFin
			)({oPosFin, oDetailAnagrafica,liste , campiModificati, recPosFin,modelPosFin, modelHana, modelFoglio, modelAmm,that, checkModifyCapitolo: false, checkModifyPG: false, state: true, typeMessage: "success" , isFoglioNotizie: false, oInfoSottostrumento})
			
		},
		checkStringifyDetailAnagrafica:  function(){
			let check = true
			// creo una stringa comprensiva dei valori di detail anagrafica.
			let modelPosFin = this.getView().getModel("modelPosFin");			
			let detailStringify = jQuery.extend(true, {}, JSON.parse(modelPosFin.getProperty("/stringifyAnagrafica")));
			let detailAnagrafica =  jQuery.extend(true, {}, modelPosFin.getProperty("/detailAnagrafica"));
			//debugger
			
			let tipoDisabilitazione = ""
			if((!detailAnagrafica.StatusCapitolo && detailStringify.StatusCapitolo)) tipoDisabilitazione = 'capitolo'
			if(!detailAnagrafica.StatusPg && detailStringify.StatusPg) tipoDisabilitazione = 'articolo'


			//effettuo il controllo solamente se è stato disabilitato uno dei stat status
			if((!detailAnagrafica.StatusPg && detailStringify.StatusPg)
				|| (!detailAnagrafica.StatusCapitolo && detailStringify.StatusCapitolo)){
					//lt controllo l'ugualianza delle devoluzioni
					let elencoCOFOG = JSON.stringify(detailAnagrafica.elencoCOFOG)
					let elencoCOFOGBk = JSON.stringify(detailStringify.elencoCOFOG)

					if(elencoCOFOG !== elencoCOFOGBk) check = false
					
					//lt controllo l'ugualianza dei collegamenti
					let collegamenti = JSON.stringify(detailAnagrafica.collegamenti)
					let collegamentiBk = JSON.stringify(detailStringify.collegamenti)
					
					if(collegamenti !== collegamentiBk) check = false
				//lt inserisco le proprietà da non controllare
				var jumpProperties = ["StatusPg", "StatusCapitolo", "elencoCOFOG", "lista_cofog", "PosizioneFinanziariaIrap", "collegamenti" , "codice_elenco", "elenchiCapitolo"]
				var propertyMod = [];
				//vado a fare un check sulle differenze...
				Object.keys(detailAnagrafica).forEach(property => {
					if(jumpProperties.indexOf(property) === -1){
						if(detailAnagrafica[property] !== detailStringify[property]){
							check = false
							propertyMod.push(property)
						}
					}
				});
				
			}

			if(!check) {
				var that = this
				//MessageBox.warning(`Attenzione, se si disabilita il Capitolo o l'Articolo non si devono effettuare altre modifiche`)				
				MessageBox.show(
					`Attenzione, se si disabilita il Capitolo o il Pg non si possono effettuare altre modifiche.`, {
						icon: MessageBox.Icon.WARNING,
						title: "Attenzione",
						actions: [MessageBox.Action.OK, 'Annulla'],
						emphasizedAction: MessageBox.Action.OK,
						onClose: function (oAction) { 
							if(oAction === 'OK'){
								that.reloadPage()
							}
						}
					}
				);
				

			}
			
			return check
						
		},
		reloadPage: async function(){
			var that = this;
			const modelPosFin = this.getView().getModel("modelPosFin");
			const oPosFin = modelPosFin.getProperty("/PosFin")
			if(that.unlock) await that.unLockPosFin();
			//const oRouter = that.getOwnerComponent().getRouter()
			that._onObjectMatched(null, {
				Fikrs: modelPosFin.getProperty("/infoSottoStrumento/Fikrs"),
				CodiceStrumento: modelPosFin.getProperty("/infoSottoStrumento/CodiceStrumento"),
				CodiceStrumentoOri: modelPosFin.getProperty("/infoSottoStrumento/CodiceStrumentoOri"),
				CodiceSottostrumento: modelPosFin.getProperty("/infoSottoStrumento/CodiceSottostrumento"),
				Datbis: modelPosFin.getProperty("/infoSottoStrumento/Datbis").toISOString(),
				Anno: oPosFin.Anno,
				Fase: oPosFin.Fase,
				Reale: oPosFin.Reale,
				Fipex: oPosFin.Fipex})
		},
		_checkEnableFPFO: async function (oParams) {
			const oPosFin = oParams.oPosFin
			const oDetailPosFin = oParams.oDetailAnagrafica
			const modelHana = oParams.modelHana
			const modelPosFin = oParams.modelPosFin
			const that = oParams.that

			let aFiltersAuth = [
				new Filter("Fikrs", FilterOperator.EQ, oPosFin.Fikrs),
				new Filter("Anno", FilterOperator.EQ, oPosFin.Anno),
				new Filter("Fase", FilterOperator.EQ, oPosFin.Fase),
				new Filter("Reale", FilterOperator.EQ, oPosFin.Reale),
				new Filter("Fipex", FilterOperator.EQ, oPosFin.Fipex)
			]
			if(modelPosFin.getProperty("/infoSottoStrumento/TipoEsposizione") === '2')
				aFiltersAuth.push(new Filter("Classificazione", FilterOperator.EQ, "FL"))
			else 
				aFiltersAuth.push(new Filter("Classificazione", FilterOperator.NE, "E"))
			
			if(oPosFin.CodiFofpSpe == "" && (oDetailPosFin.FOFP == 'FP' || oDetailPosFin.FOFP == 'FO' )){ //se è stato valorizzato il FO/FP, controllare che non ci sia più di una autorizzazione
				let aCodingBlock = await that.__getDataPromise("/AutorizzazioniSet", aFiltersAuth, modelHana)
				
				if(aCodingBlock.length >= 2 ){
					return {
						...oParams,
						state: false,
						typeMessage: "error",
						message: `La posizione finanziaria ha ${aCodingBlock.length} autorizzazioni associate e non può diventare di tipo FO/FP`
					}
				} else {
					return {
						...oParams
					}
				}
			} else {
				return {
					...oParams
				}
			}
		},
		_checkAperturaLock: async function (oParam) {

			const that = oParam.that

			//lt lock
				var sCheckLock = await that.checkLock(oParam.oPosFin);
				if (sCheckLock.bCheck === false) {			
					that.getView().setModel(new JSONModel({LOCKED:"X",MESSAGE:sCheckLock.MESSAGE}),"modelLocked");
					that.unlock = false
					console.log(`la proprietà unlock è: ${that.unlock} , arriva Bloccato con messaggio ${sCheckLock.MESSAGE}`);
					return {
						...oParam,
						state: false,
						typeMessage: "error",
						message: sCheckLock.MESSAGE
					}
					
				}else{
					that.unlock = true
					console.log(`Start salvataggio: ${that.unlock} , Blocco la sessione al salvataggio`);
					that.getView().setModel(new JSONModel({LOCKED:"",MESSAGE:""}),"modelLocked");
					return{
						...oParam
					}
				}
			
		},

		_checkFaseAmminAperta: function (oParam) {
			const oSottostrumento = oParam.modelPosFin.getProperty("/infoSottoStrumento")
			const oPosFin = oParam.oPosFin
			const modelHana = oParam.modelHana

			let aFilters = [
				new Filter("Anno", FilterOperator.EQ, oSottostrumento.AnnoSstr),
				new Filter("Fase", FilterOperator.EQ, oSottostrumento.Fase),
				new Filter("TipoSstr", FilterOperator.EQ, oSottostrumento.TipoSstr),
				new Filter("FlagStatus", FilterOperator.EQ, '1'),
				new Filter("Prctr", FilterOperator.EQ, oPosFin.Prctr),
				new Filter("StatoAmmin", FilterOperator.EQ, '1'),
			]
			return new Promise((resolve, reject) => {
				oParam.that._getEntitySet("/FasiAmminSStrSet", aFilters, modelHana)
					.then(res => {
						if(res['/FasiAmminSStrSet']) {
							resolve({
								...oParam
							})
						} else 
							resolve({
								...oParam,
								state: false,
								typeMessage: "error",
								message: "Non si possono lavorare Posizioni Finanziarie di Amministrazioni con fase chiusa"
							})
					})
			})
		},
		__checkObbligatoriValorizzati: function (oParams) {
			const oDetailAnagrafica = oParams.oDetailAnagrafica
			if(!(oDetailAnagrafica.MISSIONE && oDetailAnagrafica.PROGRAMMA && oDetailAnagrafica.AZIONE
				&& oDetailAnagrafica.TITOLO && oDetailAnagrafica.CATEGORIA && oDetailAnagrafica.CE2 && oDetailAnagrafica.CE3
				&& oDetailAnagrafica.CDR && oDetailAnagrafica.RAG && oDetailAnagrafica.MAC)) {
					return {
						...oParams,
						state: false,
						typeMessage: "error",
						message: "Valorizzare i campi obbligatori"
					}
				 }else if(!(parseInt(oDetailAnagrafica.MAC) > 0)){
					return {
						...oParams,
						state: false,
						typeMessage: "error",
						message: "Attenzione Valorizzare Correttamente il Campo Mac"
					}
				 } else {
					return {
						...oParams
					}
				 }

		},
		__getPosFinElenchiCofog: function (oParam) {
			const oPosFin = oParam.oPosFin
			const oDetailAnagrafica = oParam.oDetailAnagrafica
			const modelHana = oParam.modelHana
			const that = oParam.that
			
			let modelPosFin = that.getView().getModel("modelPosFin")
			let aFiltersIrap = [new Filter("Fikrs", FilterOperator.EQ, "S001"),
								new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
								new Filter("Capitolo", FilterOperator.EQ, oPosFin.Capitolo),
								new Filter("Prctr", FilterOperator.EQ, oPosFin.Prctr),
								new Filter("Eos", FilterOperator.EQ, oPosFin.Eos),
								new Filter("Fase", FilterOperator.EQ, oPosFin.Fase),
								// new Filter("Reale", FilterOperator.EQ, oPosFin.Reale)
							]
			if(modelPosFin.getProperty("/infoSottoStrumento/Reale") == "S")
				aFiltersIrap.push(new Filter({
					filters: [
								new Filter("Reale", FilterOperator.EQ, "R"),
								new Filter("Reale", FilterOperator.EQ, "S0001")
							],
					and : false
				}))
			else
				aFiltersIrap.push(new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")))


			
			let aDBCall = [
				that.__getDataPromise("/PosizioneFinanziariaSet", [
																	new Filter("Fikrs", FilterOperator.EQ, oPosFin.Fikrs),
																	new Filter("Anno", FilterOperator.EQ, oPosFin.Anno),
																	new Filter("Fase", FilterOperator.EQ, oPosFin.Fase),
																	new Filter("Reale", FilterOperator.EQ, oPosFin.Reale),
																	new Filter("Fipex", FilterOperator.EQ, oPosFin.Fipex)
																], modelHana
																),
				that.__getDataPromise("/TipCapitoloSet", [
																new Filter("Fikrs", FilterOperator.EQ, oPosFin.Fikrs),
																new Filter("Fase", FilterOperator.EQ, oPosFin.Fase),
																new Filter("Anno", FilterOperator.EQ, oPosFin.Anno),
																new Filter("Reale", FilterOperator.EQ, oPosFin.Reale),
																new Filter("Eos", FilterOperator.EQ, oPosFin.Eos),
																new Filter("Prctr", FilterOperator.EQ, oPosFin.Prctr),
																new Filter("Capitolo", FilterOperator.EQ, oPosFin.Capitolo),
																new Filter("Pg", FilterOperator.EQ, oPosFin.Pg)
																		], modelHana),
				that.__getDataPromise("/CapitoloElencoSet", [
																new Filter("Fikrs", FilterOperator.EQ, oPosFin.Fikrs),
																new Filter("Fase", FilterOperator.EQ, oPosFin.Fase),
																new Filter("Anno", FilterOperator.EQ,oPosFin.Anno),
																new Filter("Reale", FilterOperator.EQ, oPosFin.Reale),
																new Filter("Eos", FilterOperator.EQ, oPosFin.Eos),
																new Filter("Capitolo", FilterOperator.EQ, oPosFin.Capitolo),
																new Filter("Prctr", FilterOperator.EQ, oPosFin.Prctr),
																new Filter({
																	filters: [new Filter("PrctrElenco", FilterOperator.EQ, oPosFin.Prctr),
																			new Filter("PrctrElenco", FilterOperator.EQ, "A020")
																			],
																	and: false,
																}),
																new Filter({
																	filters: [
																				new Filter("Pg", FilterOperator.EQ, "00"),
																				new Filter("Pg", FilterOperator.EQ, oPosFin.Pg)
																			],
																	and: false,
																})
																		], modelHana),
				that.__getDataPromise("/DistribuzioneCofogSet", [
																new Filter("Fikrs", FilterOperator.EQ, oPosFin.Fikrs),
																new Filter("Fase", FilterOperator.EQ, oPosFin.Fase),
																new Filter("Anno", FilterOperator.EQ, oPosFin.Anno),
																new Filter("Reale", FilterOperator.EQ,  oPosFin.Reale),
																new Filter("Fipex", FilterOperator.EQ, oPosFin.Fipex.replaceAll(".", ""))
																		], modelHana),
				that.__getDataPromise("/PosizioneFinanziariaIrapSet", aFiltersIrap , modelHana)
			]

			return new Promise((resolve, reject) => {
				Promise.all(aDBCall)
						.then(res =>  {
							res[0][0].UpdateSstrLog= []
							resolve({
									  ...oParam,
									  oPosFin: res[0][0],
									  oCapitoloPGOrigi: res[1][0],
									  aElenchiOrigi : res[2],
									  aCofogOrigi : res[3],
									  aIrapOrigi : res[4],
									})
						})
						.catch(err => {
							reject({
								...oParam,
								message: "Errore nel salvataggio",
								state: false
							})
						})
			})
		},
		__checkModificaCapitolo: function (oParams) {
			const oCapArtOriginale = oParams.oCapitoloPGOrigi
			const oDetailAnagrafica = oParams.oDetailAnagrafica
			const oPosFin = oParams.oPosFin
			const that = oParams.that
			const aElenchiOriginali = oParams.aElenchiOrigi
			const aIrapOriginali = oParams.aIrapOrigi
			const aCofogOriginali = oParams.aCofogOrigi
			oParams.UpdateSstrLog = []
			//Check Campi modificati
			if(oPosFin.Capitolone !== oDetailAnagrafica.Capitolone) {
				oParams.UpdateSstrLog.push(that.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
													oPosFin.Datbis, "ZKPOSFIN", "Capitolone", "U", oDetailAnagrafica.Capitolone === true ? 'X' : '', oPosFin.Capitolone === true ? 'X' : '']))
				oParams.checkModifyCapitolo = true
			}
			if(oPosFin.CodiceTipospCapSpe !== oDetailAnagrafica.tipoSpesaCapitolo) {
				oParams.UpdateSstrLog.push(that.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
													oPosFin.Datbis, "ZKPOSFIN", "CodiceTipospCapSpe", "U", oDetailAnagrafica.tipoSpesaCapitolo, oPosFin.CodiceTipospCapSpe]))
				oParams.checkModifyCapitolo = true
			}
			if(oPosFin.CuIrapNoncu !== oDetailAnagrafica.CuIrapNoncu) {
				oParams.UpdateSstrLog.push(that.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
													oPosFin.Datbis, "ZKPOSFIN", "CuIrapNoncu", "U", oDetailAnagrafica.CuIrapNoncu, oPosFin.CuIrapNoncu]))
				oParams.checkModifyCapitolo = true
			}
			if((oPosFin.Mac !== oDetailAnagrafica.MAC) && (oDetailAnagrafica.MAC !== undefined && oDetailAnagrafica.MAC !== null)) {
				oParams.UpdateSstrLog.push(that.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
													oPosFin.Datbis, "ZKPOSFIN", "Mac", "U", oDetailAnagrafica.MAC, oPosFin.Mac]))
				oParams.checkModifyCapitolo = true
			}
			if(oPosFin.NaturaSpesa !== oDetailAnagrafica.CodiceNaturaSpesa) {
				oParams.UpdateSstrLog.push(that.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
													oPosFin.Datbis, "ZKPOSFIN", "NaturaSpesa", "U", oDetailAnagrafica.CodiceNaturaSpesa, oPosFin.NaturaSpesa]))
				oParams.checkModifyCapitolo = true	
			}
			if(oPosFin.Noipa !== oDetailAnagrafica.Noipa) {
				oParams.UpdateSstrLog.push(that.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
													oPosFin.Datbis, "ZKPOSFIN", "Noipa", "U", oDetailAnagrafica.Noipa, oPosFin.Noipa]))
				oParams.checkModifyCapitolo = true
			}
			if((oPosFin.StatusCapitolo === "3" ? false : true) !== oDetailAnagrafica.StatusCapitolo) {
				oParams.UpdateSstrLog.push(that.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
													oPosFin.Datbis, "ZKPOSFIN", "StatusCapitolo", "U", oDetailAnagrafica.StatusCapitolo === false ? "3" : (oPosFin.StatusCapitolo === "3" && oDetailAnagrafica.StatusCapitolo === true ? (oDetailAnagrafica.VersioneCapitolo === "D" ? "1" : "0") : oPosFin.StatusCapitolo), oPosFin.StatusCapitolo]))
				oParams.checkModifyCapitolo = true
			}
			if(oPosFin.TipoFondo !== oDetailAnagrafica.tipoFondo) {
				oParams.UpdateSstrLog.push(that.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
													oPosFin.Datbis, "ZKPOSFIN", "TipoFondo", "U", oDetailAnagrafica.tipoFondo, oPosFin.TipoFondo]))
				oParams.checkModifyCapitolo = true
			}
			if(oPosFin.FlagMemcor01 !== oDetailAnagrafica.Memoria) {
				oParams.UpdateSstrLog.push(that.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
													oPosFin.Datbis, "ZKPOSFIN", "FlagMemcor01", "U", (oDetailAnagrafica.Memoria === true ? "X" : ""), (oPosFin.FlagMemcor01 === true ? "X" : "")]))
				oParams.checkModifyCapitolo = true
			}			
			//Denominazione capitolo
			if(!oDetailAnagrafica.CODICE_STANDARD_CAPITOLO){
				if(oDetailAnagrafica.CD_CAPITOLO_DEN_EST !==  oCapArtOriginale.DescEstesaCapitolo ) {
					oParams.UpdateSstrLog.push(that.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
						 	oPosFin.Datbis, "ZKTIP_CAPITOLO", "DescEstesaCapitolo", "U", oDetailAnagrafica.CD_CAPITOLO_DEN_EST.substring(0, 250), oCapArtOriginale.DescEstesaCapitolo.substring(0, 250)]))
					oParams.checkModifyCapitolo = true
				}
				if(oDetailAnagrafica.CD_CAPITOLO_DEN_BREVE !== oCapArtOriginale.DescBreveCapitolo) {
					oParams.UpdateSstrLog.push(that.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
						oPosFin.Datbis, "ZKTIP_CAPITOLO", "DescBreveCapitolo", "U", oDetailAnagrafica.CD_CAPITOLO_DEN_BREVE.substring(0, 250), oCapArtOriginale.DescBreveCapitolo.substring(0, 250)]))
					oParams.checkModifyCapitolo = true
				}
			} else {
				if(oDetailAnagrafica.CODICE_STANDARD_CAPITOLO !== oCapArtOriginale.CodiceStdCapitolo){
					oParams.UpdateSstrLog.push(that.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
						oPosFin.Datbis, "ZKTIP_CAPITOLO", "CodiceStdCapitolo", "U", oDetailAnagrafica.CODICE_STANDARD_CAPITOLO, oCapArtOriginale.CodiceStdCapitolo]))
					oParams.checkModifyCapitolo = true
				}
			}
			if(oPosFin.Cdr !== oDetailAnagrafica.CDR && oDetailAnagrafica.CDR) {
				oParams.UpdateSstrLog.push(that.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
													oPosFin.Datbis, "ZKPOSFIN", "Cdr", "U", oDetailAnagrafica.CDR, oPosFin.Cdr]))
				oParams.checkModifyCapitolo = true
			}
			//! controllo modifica IRAP
			debugger 
			//check Irap Modificati
			for(let i = 0 ; i < oDetailAnagrafica.PosizioneFinanziariaIrap.length ; i++){
				let currentIrap = oDetailAnagrafica.PosizioneFinanziariaIrap[i]
				let oFindIrap = []
				oFindIrap = aIrapOriginali.filter(el => (el.Fipex == currentIrap.Fipex )
					)
				if(oFindIrap.length === 0) {
					oParams.checkModifyCapitolo = true
					
				}
			}
			for(let i = 0 ; i < aIrapOriginali.length ; i++){
				let currentIrap = aIrapOriginali[i]
				let oFindIrap = []
				oFindIrap = oDetailAnagrafica.PosizioneFinanziariaIrap.filter(el => (el.Fipex == currentIrap.Fipex )
					)
				if(oFindIrap.length === 0) {
					oParams.checkModifyCapitolo = true
				}
			}


			//check Elenchi modificati
			for(let i = 0 ; i < oDetailAnagrafica.elenchiCapitolo.length ; i++){
				let currentElencoCap = oDetailAnagrafica.elenchiCapitolo[i]
				let oFindElenco = []
				oFindElenco = aElenchiOriginali.filter(el => (el.Fikrs == currentElencoCap.Fikrs &&
					el.Anno == currentElencoCap.Anno &&
					el.Fase == currentElencoCap.Fase &&
					el.Reale == currentElencoCap.Reale &&
					el.Versione == currentElencoCap.Versione &&
					el.Eos == currentElencoCap.Eos &&
					el.Prctr == currentElencoCap.Prctr &&
					el.Capitolo == currentElencoCap.Capitolo &&
					el.Pg == currentElencoCap.Pg &&
					el.PrctrElenco == currentElencoCap.PrctrElenco &&
					el.NumeroElenco == currentElencoCap.NumeroElenco 
					)
					)
				if(oFindElenco.length === 0) {
					oParams.checkModifyCapitolo = true
					oParams.UpdateSstrLog.push(that.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
						oPosFin.Datbis, "", "", "", "", ""]))
				}
			}
			for(let i = 0 ; i < aElenchiOriginali.length ; i++){
				let currentElencoCap = aElenchiOriginali[i]
				let oFindElenco = []
				 oFindElenco = oDetailAnagrafica.elenchiCapitolo.filter(el => (el.Fikrs == currentElencoCap.Fikrs &&
					el.Anno == currentElencoCap.Anno &&
					el.Fase == currentElencoCap.Fase &&
					el.Reale == currentElencoCap.Reale &&
					el.Versione == currentElencoCap.Versione &&
					el.Eos == currentElencoCap.Eos &&
					el.Prctr == currentElencoCap.Prctr &&
					el.Capitolo == currentElencoCap.Capitolo &&
					el.Pg == currentElencoCap.Pg &&
					el.PrctrElenco == currentElencoCap.PrctrElenco &&
					el.NumeroElenco == currentElencoCap.NumeroElenco 
					)
					)
				if(oFindElenco.length === 0) {
					oParams.checkModifyCapitolo = true
					oParams.UpdateSstrLog.push(that.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
						oPosFin.Datbis, "", "", "", "", ""]))
				}
			}

			//check Modifica Cofog
			if(oDetailAnagrafica.elencoCOFOG.length !== aCofogOriginali.length){
				oParams.checkModifyCapitolo = true
				oParams.campiModificati.COFOG = true
			}
			
			for(let i = 0 ; i < oDetailAnagrafica.elencoCOFOG.length ; i++){
				let currentCofog = oDetailAnagrafica.elencoCOFOG[i]
				let oFindCofog = []
				oFindCofog = aCofogOriginali.filter(el => (
					el.CofogL1 === currentCofog.CofogL1 &&
					el.CofogL2 === currentCofog.CofogL2 &&
					el.CofogL3 === currentCofog.CofogL3 
					)
					)
				if(oFindCofog.length === 0) {
					oParams.UpdateSstrLog.push(that.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
						oPosFin.Datbis, "", "", "", "", ""]))
					oParams.checkModifyCapitolo = true
					oParams.campiModificati.COFOG = true
				}
				else 
					if(that.formatPercent(oFindCofog[0].PercCofog) != that.formatPercent(currentCofog.PercCofog)){
						oParams.UpdateSstrLog.push(that.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
							oPosFin.Datbis, "", "", "", "", ""]))
						oParams.checkModifyCapitolo = true
						oParams.campiModificati.COFOG = true
					}
			}
			//lt check con Beniamino. se elenco modificato = 0 e originali > 0 allora pusho il record per il back-end
			if(oParams.checkModifyCapitolo && oDetailAnagrafica.elencoCOFOG.length === 0 && aCofogOriginali.length > 0){
				oParams.UpdateSstrLog.push(that.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
					oPosFin.Datbis, "", "", "", "", ""]))
			}
			if(oParams.UpdateSstrLog.length === 0)
				oParams.UpdateSstrLog.push(that.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
					oPosFin.Datbis, "", "", "", "", ""]))
			return {
				...oParams
			}
		},
		__checkModificaPG: function (oParams) {
			const oCapArtOriginale = oParams.oCapitoloPGOrigi
			const oDetailAnagrafica = oParams.oDetailAnagrafica
			const oPosFin = oParams.oPosFin
			const that = oParams.that
			oParams.oPosFin.UpdateSstrLog = []
			//Check Campi modificati
			if(oPosFin.AreaDestinataria !== oDetailAnagrafica.AreaDestinataria) {
				oParams.UpdateSstrLog.push(that.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
														oPosFin.Datbis, "ZKPOSFIN", "AreaDestinataria", "U", oDetailAnagrafica.AreaDestinataria, oPosFin.AreaDestinataria]))
				oParams.checkModifyPG = true
			}
			if(oPosFin.ObiettiviMinisteri !== oDetailAnagrafica.ObiettiviMinisteri) {
				oParams.UpdateSstrLog.push(that.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
													oPosFin.Datbis, "ZKPOSFIN", "ObiettiviMinisteri", "U", (oDetailAnagrafica.ObiettiviMinisteri === true ? "X" : ""), oPosFin.ObiettiviMinisteri === true ? "X" : ""]))
				oParams.checkModifyPG = true
			}
			if(oPosFin.RuoliSpesaFissa !== oDetailAnagrafica.RuoliSpesaFissa ) {
				oParams.UpdateSstrLog.push(that.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
													oPosFin.Datbis, "ZKPOSFIN", "RuoliSpesaFissa", "U", (oDetailAnagrafica.RuoliSpesaFissa === false ? "" : "X"), (oPosFin.RuoliSpesaFissa === false ? "" : "X")]))
				oParams.checkModifyPG = true
			}
			if((oPosFin.StatusPg === "3" ? false : true) !== oDetailAnagrafica.StatusPg ) {
				oParams.UpdateSstrLog.push(that.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
													oPosFin.Datbis, "ZKPOSFIN", "StatusPg", "U", oDetailAnagrafica.StatusPg === false ? "3" : ((oPosFin.StatusPg === "3" && oDetailAnagrafica.StatusPg === true) ? (oDetailAnagrafica.VersionePg === "D" ? "1" : "0") : oPosFin.StatusPg), oPosFin.StatusPg]))
				oParams.checkModifyPG = true
			}
			if(oPosFin.TipoSpesaPg !== oDetailAnagrafica.TipoSpesaPg) {
				oParams.UpdateSstrLog.push(that.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
													oPosFin.Datbis, "ZKPOSFIN", "TipoSpesaPg", "U", oDetailAnagrafica.TipoSpesaPg, oPosFin.TipoSpesaPg]))
				oParams.checkModifyPG = true
			}
			if(oPosFin.CodiFofpSpe !== oDetailAnagrafica.FOFP) {
				oParams.UpdateSstrLog.push(that.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
													oPosFin.Datbis, "ZKPOSFIN", "CodiFofpSpe", "U", oDetailAnagrafica.FOFP, oPosFin.CodiFofpSpe]))
				oParams.checkModifyPG = true
			}

			//Denominazione Pg
			if(!oDetailAnagrafica.CODICE_STANDARD_PG){
				if(oDetailAnagrafica.CD_PG_DEN_EST !==  oCapArtOriginale.DescEstesaPg ) {
					oParams.UpdateSstrLog.push(that.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
						 	oPosFin.Datbis, "ZKTIP_PG", "DescEstesaPg", "U", oDetailAnagrafica.CD_PG_DEN_EST, oCapArtOriginale.DescEstesaPg]))
					//checkCapitolo = true non capisco perche
					oParams.checkModifyPG = true
				}
				if(oDetailAnagrafica.CD_PG_DEN_BREVE !== oCapArtOriginale.DescBrevePg) {
					oParams.UpdateSstrLog.push(that.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
						oPosFin.Datbis, "ZKTIP_PG", "DescBrevePg", "U", oDetailAnagrafica.CD_PG_DEN_BREVE, oCapArtOriginale.DescBrevePg]))
			   		//checkCapitolo = true
					   oParams.checkModifyPG = true
				}
			} else {
				if(oDetailAnagrafica.CODICE_STANDARD_PG !== oCapArtOriginale.CodiceStdPg){
					oParams.UpdateSstrLog.push(that.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
						oPosFin.Datbis, "ZKTIP_PG", "CodiceStdPg", "U", oDetailAnagrafica.CODICE_STANDARD_PG, oCapArtOriginale.CodiceStdPg]))
			   		//checkCapitolo = true
					   oParams.checkModifyPG = true
				}
			}
			return {
				...oParams
			}
		},
		__checkChiaviModified: function (oParams) {
			const oDetailAnagrafica = oParams.oDetailAnagrafica
			const oPosFin = oParams.oPosFin
			let oCambioPosFin = {}
			let aCambioPosFin = []
			let checkChiaviCambio = false
			let checkChiaviCe = false

			if(oDetailAnagrafica.MISSIONE !== oPosFin.Missione || oDetailAnagrafica.PROGRAMMA !== oPosFin.Programma
				|| oDetailAnagrafica.AZIONE !== oPosFin.Azione) {
				oCambioPosFin.CodiceMissione =  oDetailAnagrafica.MISSIONE
				oCambioPosFin.CodiceProgramma =  oDetailAnagrafica.PROGRAMMA
				oCambioPosFin.CodiceAzione =  oDetailAnagrafica.AZIONE
				checkChiaviCambio = true
				if(oDetailAnagrafica.MISSIONE !== oPosFin.Missione) oParams.campiModificati.Missione = true
				if(oDetailAnagrafica.PROGRAMMA !== oPosFin.Programma) oParams.campiModificati.Programma = true
				if(oDetailAnagrafica.AZIONE !== oPosFin.Azione) oParams.campiModificati.Azione = true

			} else {
				oCambioPosFin.CodiceMissione = ""
				oCambioPosFin.CodiceProgramma= ""
				oCambioPosFin.CodiceAzione = ""
			}
			oCambioPosFin.CodiceCdr = ""
			//lt 20231011 -> ID 61 FE Bug
			//Se sono cambiate Programma o Azione devo mettere il nuovo CDR
			if(oDetailAnagrafica.PROGRAMMA !== oPosFin.Programma
				|| oDetailAnagrafica.AZIONE !== oPosFin.Azione) {				
					//oCambioPosFin.CodiceCdr = oDetailAnagrafica.CDR
					if(oPosFin.Cdr !== oDetailAnagrafica.CDR){
						oParams.campiModificati.Cdr = true
					}
				}
			
			if(oDetailAnagrafica.TITOLO !== oPosFin.Titolo || oDetailAnagrafica.CATEGORIA !== oPosFin.Categoria) {					
					oCambioPosFin.CodiceCategoria =  oDetailAnagrafica.CATEGORIA
					oCambioPosFin.CodiceTitolo =  oDetailAnagrafica.TITOLO
					checkChiaviCambio = true
					if(oDetailAnagrafica.TITOLO !== oPosFin.Titolo) oParams.campiModificati.Titolo = true
					if(oDetailAnagrafica.CATEGORIA !== oPosFin.Categoria) oParams.campiModificati.Categoria = true
			} else {
				oCambioPosFin.CodiceCategoria =  ""
				oCambioPosFin.CodiceTitolo =  ""
			}


			// 
			if(oDetailAnagrafica.CE2 !== oPosFin.Ce2 || oDetailAnagrafica.CE3 !== oPosFin.Ce3) {
				oCambioPosFin.CodiceCe2 =  oDetailAnagrafica.CE2
				oCambioPosFin.CodiceCe3 =  oDetailAnagrafica.CE3
				if(oDetailAnagrafica.CE2 !== oPosFin.Ce2) oParams.campiModificati.CE2 = true
				if(oDetailAnagrafica.CE3 !== oPosFin.Ce3) oParams.campiModificati.CE3 = true
				if(!checkChiaviCambio) checkChiaviCe = true;				
				checkChiaviCambio = true
			} else {
				checkChiaviCe = false;
				oCambioPosFin.CodiceCe2 =  ""
				oCambioPosFin.CodiceCe3 = ""
			}

			oCambioPosFin.Fikrs = oPosFin.Fikrs
			oCambioPosFin.Anno = oPosFin.Anno
			oCambioPosFin.Fase = oPosFin.Fase
			oCambioPosFin.Reale = oPosFin.Reale
			oCambioPosFin.Fipex = oPosFin.Fipex
			//oCambioPosFin.Prctr = oPosFin.Prctr
			oCambioPosFin.CodiceNatura = ""
			oCambioPosFin.CodiceTipologia = ""
			oCambioPosFin.CodiceProvento = ""

			aCambioPosFin.push(oCambioPosFin)

			return {
				...oParams,
				UpdateCambioPosfin : aCambioPosFin,
				checkChiaviCambio: checkChiaviCambio,
				checkChiaviCe: checkChiaviCe
			}	
		},
		__getRelatedPosFin: function (oParams) {
			const oPosFin = oParams.oPosFin
			const that = oParams.that
			const modelHana = oParams.modelHana

			let aFilters = [
				new Filter("FIKRS", FilterOperator.EQ, oPosFin.Fikrs),
				new Filter("FASE", FilterOperator.EQ, oPosFin.Fase),
				new Filter("ANNO", FilterOperator.EQ, oPosFin.Anno),
				new Filter("CODICE_CAPITOLO", FilterOperator.EQ, oPosFin.Capitolo),
				new Filter("REALE", FilterOperator.EQ, oPosFin.Reale),
				new Filter("PRCTR", FilterOperator.EQ, oPosFin.Prctr),
				new Filter("FIPEX", FilterOperator.NE, oPosFin.Fipex)
			]

			return new Promise((resolve, reject) => {
				if(oParams.state) {
					if(oParams.checkModifyCapitolo || oParams.checkChiaviCambio || (oParams.isFoglioNotizie && oParams.isModifcaCap))	{
						oParams.modelAmm.read("/ZES_POSFIN_SA_SET", {
							filters: aFilters,
							//urlParameters: {"$orderby": "Capitolo,Pg"},
							//urlParameters: {"$expand": "NAV_COFOG,NAV_ELENCHI,NAV_IRAP"},
							success: (oData) => {
								resolve({
									...oParams,
									aRelatedPosFin: oData.results
								})
							},
							error: (err) => {
								//debugger
								//!lt gestisco l'eventuale errore...
								if(err.statusCode === "404" && err.statusText === "Not Found"){
									resolve({
										...oParams,
										aRelatedPosFin: []
									})
								}								
							}
						})
					} else {
						resolve({
							...oParams,
							aRelatedPosFin: []
						})
					}
				} else {
					resolve({
						...oParams,
						aRelatedPosFin: []
					})
				}
			})
		},
		__checkLastPgAttivo: function(oParams) {
			const oPosFin = oParams.oPosFin
			const that = oParams.that
			const modelHana = oParams.modelHana

			let aFilters = [
				new Filter("Fikrs", FilterOperator.EQ, oPosFin.Fikrs),
				new Filter("Fase", FilterOperator.EQ, oPosFin.Fase),
				new Filter("Anno", FilterOperator.EQ, oPosFin.Anno),
				new Filter("Capitolo", FilterOperator.EQ, oPosFin.Capitolo),
				new Filter("Reale", FilterOperator.EQ, oPosFin.Reale),
				new Filter("Prctr", FilterOperator.EQ, oPosFin.Prctr),
				new Filter("Fipex", FilterOperator.NE, oPosFin.Fipex),
				new Filter("Eos", FilterOperator.EQ, oPosFin.Eos)
			]
			return new Promise((resolve, reject) => {
				if(oParams.state) {
					if(oParams.UpdateSstrLog.find(it => it.Fname === "StatusPg" && it.ValueNew === "3") )	{
						modelHana.read("/PosizioneFinanziariaSet", {
							filters: aFilters,
							urlParameters: {"$orderby": "Capitolo,Pg"},
							success: (oData) => {
								if(oData.results.find(it => it.StatusPg !==	"3")) //ne trovo almeno uno attivo
									resolve({
										...oParams
									})
								else {
									resolve({ //nessuno attivo, passo le related
										...oParams,
										isFromLastPg: true,
										aRelatedPosFin: oData.results
									})
								}
							}
						})
					} else {
						resolve({
							...oParams
						})
					}
				} else {
					resolve({
						...oParams
					})
				}
			})
		},
		__checkSumCofog: function (oParams) {
			//check somma cofog o almeno una cofog inserita
			let state = true
			let messageErrorCofog = ""
			const sumCofog = oParams.oDetailAnagrafica.elencoCOFOG.reduce((partialSum, a) => partialSum + parseFloat(a.PercCofog, 2), 0)
			const checkSommaCofog = sumCofog === parseFloat(100, 2)
			let checkPercNegative = oParams.oDetailAnagrafica.elencoCOFOG.every(cf => cf.PercCofog >= 0)
			if(!checkPercNegative) {
				state = false
				messageErrorCofog = "Le COFOG non possono avere percentuale negative"
			} else if(!checkSommaCofog) {
				state = false
				messageErrorCofog = oParams.oDetailAnagrafica.elencoCOFOG.length > 0 ? ( oParams.oDetailAnagrafica.elencoCOFOG.length === 1 ? "La COFOG deve avere percentuale uguale a 100" : "La somma delle percentuali COFOG è diversa da 100") : "Inserire almeno una COFOG"
			}

			//if(sumCofog !== parseFloat(100, 2)){
			if(!state) {
				return {
					...oParams,
					state: false,
					typeMessage: "error",
					onOk: true,
					message: messageErrorCofog //oParams.oDetailAnagrafica.elencoCOFOG.length > 0 ? ( oParams.oDetailAnagrafica.elencoCOFOG.length === 1 ? "La COFOG deve avere percentuale uguale a 100" : "La somma delle percentuali COFOG è diversa da 100") : "Inserire almeno una COFOG"
				}
			} else {
				return {
					...oParams
				}
			}
		},
		__checkFoglioNotizie: function (oParams) {
			const campiMod = oParams.campiModificati
			
			Object.keys(campiMod).forEach(property => {
				if(campiMod[property]) oParams.isFoglioNotizie = true
			});

			var modificaCapitolo = 	[
				"Cdr" ,
				"Missione" ,
				"Programma" ,
				"Azione" ,
				"COFOG" ,
				"Titolo" ,
				"Categoria" ]

				oParams.isModifcaCap = false

				modificaCapitolo.forEach(cap => {
					if(campiMod[cap]) oParams.isModifcaCap = true
				});

			//!LT -> devo controllare se il capitolo è disattivo
			if(!oParams.oDetailAnagrafica.StatusCapitolo || !oParams.oDetailAnagrafica.StatusPg) oParams.isFoglioNotizie = false
			return {
				...oParams
			}
		},
		__setVideoMessage: function (oParams) {
			if((oParams.checkModifyCapitolo && oParams.aRelatedPosFin.length !== 0) || (oParams.checkChiaviCambio && oParams.aRelatedPosFin.length !== 0)) { //&& !oParams.checkChiaviCe
				const modelPosFin = oParams.that.getView().getModel("modelPosFin")
				var listViewVisible = false;
				if(oParams.checkChiaviCambio && oParams.checkChiaviCe && !oParams.isModifcaCap){
					modelPosFin.setProperty("/messageToSave", "Si sta effettuando un cambio della posizione finanziaria. Continuare ?")
					//lt modifica codice. se viene cambiato solo CE2 o CE3 non devono essere modificate anche le pos fin relazionate
					oParams.aRelatedPosFin = [];
				} else {
					modelPosFin.setProperty("/messageToSave", oParams.oDetailAnagrafica.StatusCapitolo ? "Le seguenti posizioni finanziarie saranno aggiornate:": "Contestualmente alla disattivazione della posizione finanziaria, saranno disattivate le seguenti posizioni finanziarie:")
					listViewVisible = true;
				}
				modelPosFin.setProperty("/listViewVisible", listViewVisible)
				modelPosFin.setProperty("/posFinUpdate", oParams.aRelatedPosFin)
				modelPosFin.setProperty("/PressAnnulla", false)
				
				return new Promise((resolve, reject) => {
					if(!oParams.that.oDialogMessageSave)
						Fragment.load({
							name:"zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.HVPosFin.ElencoPosFinUpdate2",
							controller: oParams.that
						}).then(oDialog => {
							oParams.that.oDialogMessageSave = oDialog
							oParams.that.getView().addDependent(oDialog)
							oParams.that.oDialogMessageSave.attachEvent("beforeClose", function (oEvnt) {
								resolve({
									 	...oParams,
										onOk: modelPosFin.getProperty("/onOk")
									 })
							})
							oParams.that.oDialogMessageSave.open()
						})
					else	
						oParams.that.oDialogMessageSave.open()
				})
			} else {
				return {
					...oParams,
					onOk: true
				}
			}
		},
		onOkFromUtente: function (oEvent) {
			const modelPosFin = this.getView().getModel("modelPosFin")
			modelPosFin.setProperty("/onOk", true)
			oEvent.getSource().getParent().close()
			oEvent.getSource().getParent().destroy()
			this.oDialogMessageSave = undefined
		},
		onAnnullaFromUtente: function (oEvent) {
			const modelPosFin = this.getView().getModel("modelPosFin")
			modelPosFin.setProperty("/onOk", false)
			modelPosFin.setProperty("/PressAnnulla", true)			
			oEvent.getSource().getParent().close()
			oEvent.getSource().getParent().destroy()
			this.oDialogMessageSave = undefined
		},
		__createPayloadModify: async function (oParams) {
			const that = oParams.that
			
			let oPayload = {}

			var payloadPerCheck =  that.createPayloadNormalPayload(oParams, true)
			delete payloadPerCheck.DataLoekz
			delete payloadPerCheck.__metadata
			let responseCheck = await that.__setDataPromiseCheck( "/PosFinCheckBeforeSaveSet" ,oParams.modelHana, payloadPerCheck)	
			//lt recupero l'eventuale errore //! inserisco anche lo stato perchè se è già negativo faccio apparire il messaggio che ha già in pancia
			if(responseCheck.error && oParams.state){
				oParams.state= false
				oParams.errorCheck = true
				oParams.typeMessage = "error"
				oParams.message= that.getErrorFromCheckPayload(responseCheck)
			}

			if(responseCheck.success && responseCheck.entity.Messagew !== ""){
				let blockSaveProcess = await that.doMesgWariningControls(responseCheck.entity.Messagew)
						if(blockSaveProcess){
						oParams.state= false
						oParams.errorCheck = true
						oParams.typeMessage = "error"
						oParams.message= "Operazione annullata dall'utente"
						
					}else{
						oParams.modificaCe2Ce3 = true
					}			
			} 

			if(oParams.isFoglioNotizie){	
				var dataPosFinRelated = []		
					for (let i = 0; i < oParams.aRelatedPosFin.length; i++) {
						const pos = oParams.aRelatedPosFin[i];
						const entity = `/${pos.__metadata.uri.split("/")[pos.__metadata.uri.split("/").length - 1]}`
						let posFinRetrived = await that.__getDataPromisePosConExp(entity, [], oParams.modelAmm , {$expand: "NAV_COFOG,NAV_COFOG,NAV_ELENCHI,NAV_IRAP"})
						dataPosFinRelated.push(posFinRetrived)
					}					
					oPayload =that.createPayloadFoglioNotizie(oParams)
			} else {
					oPayload = that.createPayloadNormalPayload(oParams)
			}
			
			return {
				...oParams,
				oPayload: oPayload
			} 
		},

		doMesgWariningControls: async function(msg) {
			return new Promise(function(resolve, reject) {
					sap.m.MessageBox.confirm(
								msg, {
									onClose: function(oAction) {
											if (oAction === sap.m.MessageBox.Action.CANCEL) {													
													resolve(true); // blockSaveProcess 
											}
											else {
													resolve(false); // go ahead
											}
									}
							}
					);
			});
	},
		getErrorFromCheckPayload: function(invio){
			if(invio.error && invio.error.statusCode === "404"){
				const message = JSON.parse(invio.error.responseText)
				if(message && message.error && message.error.message){
					return message.error.message.value
					
				}else{
					console.log(invio);
					return "Errore di comunicazione nel controllo integrità anagrafica"
				}
			}else{
				console.log(invio);
				return "Errore di comunicazione nel controllo integrità anagrafica"						
			} 
		},
		createPayloadNormalPayload: function (oParams, checkControlli) {
			const oDetailAnagrafica = oParams.oDetailAnagrafica
			let capitoliElenchi = JSON.parse(JSON.stringify(oDetailAnagrafica.elenchiCapitolo))
			let aDistrCofog = JSON.parse(JSON.stringify(oDetailAnagrafica.elencoCOFOG))
			let aPosFinIrap = JSON.parse(JSON.stringify(oDetailAnagrafica.PosizioneFinanziariaIrap))
			const oPosFin = oParams.oPosFin
			const isFromLastPg = oParams.isFromLastPg

			//Cdr : oDetailAnagrafica.CDR,
			const oPayload = {
				...oParams.oPosFin,
				Cdr : oDetailAnagrafica.CDR, //provo a vedere se mettendo il CDR si prende il valore nuovo
				UdvL1Spe : oDetailAnagrafica.UdvL1, //inserisco anche questi valori se modificati implicitamente
				UdvL2Spe : oDetailAnagrafica.UdvL2, //inserisco anche questi valori se modificati implicitamente
				AreaDestinataria : oDetailAnagrafica.AreaDestinataria ,
				Capitolone :  oDetailAnagrafica.Capitolone,
				FlagMemcor01 : oDetailAnagrafica.Memoria,
				CodiceTipospCapSpe : oDetailAnagrafica.tipoSpesaCapitolo,
				CuIrapNoncu : oDetailAnagrafica.CuIrapNoncu,
				Mac : oDetailAnagrafica.MAC,
				NaturaSpesa : oDetailAnagrafica.CodiceNaturaSpesa,
				Noipa : oDetailAnagrafica.Noipa,
				ObiettiviMinisteri : oDetailAnagrafica.ObiettiviMinisteri,
				RuoliSpesaFissa : oDetailAnagrafica.RuoliSpesaFissa,
				StatusCapitolo : oDetailAnagrafica.StatusCapitolo === false ? "3" : (oPosFin.StatusCapitolo === "3" && oDetailAnagrafica.StatusCapitolo === true ? (oDetailAnagrafica.VersioneCapitolo === "D" ? "1" : "0") : oPosFin.StatusCapitolo),
				StatusPg : oDetailAnagrafica.StatusPg === false ? "3" : ((oPosFin.StatusPg === "3" && oDetailAnagrafica.StatusPg === true) ? (oDetailAnagrafica.VersionePg === "D" ? "1" : "0") : oPosFin.StatusPg),
				TipoFondo : oDetailAnagrafica.tipoFondo,
				TipoSpesaPg : oDetailAnagrafica.TipoSpesaPg,
				CodiFofpSpe: oDetailAnagrafica.FOFP,
				Datbis : new Date(oPosFin.Datbis),
				Datab : oPosFin.Datab === null ? null :  new Date(oPosFin.Datab),
				Ersda : oPosFin.Ersda === null ? null :  new Date(oPosFin.Ersda),
				DataLoekz : oPosFin.DataLoekz === null ? null : new Date(oPosFin.DataLoekz),
				Laeda : oPosFin.Laeda === null ? null : new Date(oPosFin.Laeda),
				UpdateCapitoloElenco: function () {
					let capElenchi = []
					for(let i = 0 ; i < capitoliElenchi.length ; i ++) {
						let currentCapElenco = capitoliElenchi[i]
						delete currentCapElenco.__metadata
						delete currentCapElenco.Desc
						currentCapElenco.Fipex = oPosFin.Fipex
						currentCapElenco.Fikrs = oPosFin.Fikrs
						currentCapElenco.Anno = oPosFin.Anno
						currentCapElenco.Fase = oPosFin.Fase
						currentCapElenco.Reale = oPosFin.Reale
						currentCapElenco.Eos = oPosFin.Eos
						currentCapElenco.Prctr = currentCapElenco.Prctr ? currentCapElenco.Prctr : oPosFin.Prctr
						currentCapElenco.Capitolo = oPosFin.Capitolo
						currentCapElenco.Pg = currentCapElenco.Pg ? currentCapElenco.Pg : oPosFin.Pg
						currentCapElenco.PrctrElenco = currentCapElenco.PrctrElenco
						currentCapElenco.Versione = currentCapElenco.Versione ? currentCapElenco.Versione : "P"
						currentCapElenco.Datbis = currentCapElenco.Datbis ? new Date(currentCapElenco.Datbis) : oPosFin.Datbis
						capElenchi.push(currentCapElenco)
					}
					return capElenchi
				}(),
				UpdatePosFinIrap : function () {
					let aIrap = []
					for(let i = 0 ; i < aPosFinIrap.length ; i ++){
						let currentIrap = aPosFinIrap[i]
						aIrap.push(
							{
								Fikrs : oPosFin.Fikrs,
								Anno : oPosFin.Anno,
								Eos : "S",
								Fase : oPosFin.Fase,
								Fipex : currentIrap.Fipex,
								Versione : currentIrap.Versione ? currentIrap.Versione : "P",
								Reale : "R",
								Prctr : oPosFin.Prctr,
								CodiceCapitolo : oPosFin.Capitolo,
								Datbis : new Date(oPosFin.Datbis)
							}
						)
						
					}
					return aIrap
				}(),
				DistribuzioneCofog: function () {
					let aCofog = []
					for(let i = 0 ; i < aDistrCofog.length ; i ++){
						let currentCofog = aDistrCofog[i]
						currentCofog.Fikrs = oPosFin.Fikrs
						currentCofog.Anno = oPosFin.Anno
						currentCofog.Reale = oPosFin.Reale
						currentCofog.Versione = currentCofog.Versione ? currentCofog.Versione : "P"//oPosFin.Versione
						currentCofog.Fase = oPosFin.Fase
						currentCofog.Fipex = oPosFin.Fipex
						currentCofog.Datbis = currentCofog.Datbis ? new Date(currentCofog.Datbis) : new Date(oPosFin.Datbis)
						currentCofog.PercCofog = Number(currentCofog.PercCofog).toFixed(2)
						delete currentCofog.__metadata
						delete currentCofog.Desc
						
						aCofog.push(currentCofog)
					}
					return aCofog
				}(),
				UpdateTipCapitolo: oParams.checkModifyPG === true || oParams.checkModifyCapitolo === true || oParams.checkChiaviCambio === true ? 
										function () {
											// let aTipCapitolo = []
											// aTipCapitolo.push({
											return {
												Fikrs: oPosFin.Fikrs,
												Anno: oPosFin.Anno,
												Fase: oPosFin.Fase,
												Reale: oPosFin.Reale,
												VersioneCapitolo: oDetailAnagrafica.VersioneCapitolo,
												VersionePg: oDetailAnagrafica.VersionePg,
												Eos: oPosFin.Eos,
												Prctr: oPosFin.Prctr,
												Fipex: oPosFin.Fipex,
												Capitolo: oDetailAnagrafica.CAPITOLO,
												Pg: oDetailAnagrafica.pg,
												Datbis: oPosFin.Datbis,
												DescBreveCapitolo: !oDetailAnagrafica.CODICE_STANDARD_CAPITOLO ?  oDetailAnagrafica.CD_CAPITOLO_DEN_BREVE : oParams.oCapitoloPGOrigi.DescBreveCapitolo,
												DescEstesaCapitolo: !oDetailAnagrafica.CODICE_STANDARD_CAPITOLO ? oDetailAnagrafica.CD_CAPITOLO_DEN_EST : oParams.oCapitoloPGOrigi.DescEstesaCapitolo,
												DescBrevePg: !oDetailAnagrafica.CODICE_STANDARD_PG ? oDetailAnagrafica.CD_PG_DEN_BREVE : oParams.oCapitoloPGOrigi.DescBrevePg,
												DescEstesaPg: !oDetailAnagrafica.CODICE_STANDARD_PG ? oDetailAnagrafica.CD_PG_DEN_EST : oParams.oCapitoloPGOrigi.DescEstesaPg,
												CodiceStdCapitolo: oDetailAnagrafica.CODICE_STANDARD_CAPITOLO ? oDetailAnagrafica.CODICE_STANDARD_CAPITOLO : "000",
												CodiceStdPg: oDetailAnagrafica.CODICE_STANDARD_PG ? oDetailAnagrafica.CODICE_STANDARD_PG : "000"
											}
											// })
										} () : {}, //[]
				UpdateRelatedPosfin: function(){
					 let aArray = []
					  for(let i = 0; i < oParams.aRelatedPosFin.length; i++){
						const dataFine = oParams.aRelatedPosFin[i].DATBIS
						aArray.push({
							Fikrs: oParams.oPosFin.Fikrs,
							Anno: oParams.oPosFin.Anno,
							Fase: oParams.oPosFin.Fase,
							Reale: oParams.oPosFin.Reale,
							Versione: oParams.oPosFin.Versione,
							Fipex: oParams.oPosFin.Fipex,
							Datbis: new Date(oParams.oPosFin.Datbis),
							RelatedFikrs: !isFromLastPg ? oParams.aRelatedPosFin[i].FIKRS : oParams.aRelatedPosFin[i].Fikrs,
							RelatedAnno: !isFromLastPg ? oParams.aRelatedPosFin[i].ANNO : oParams.aRelatedPosFin[i].Anno,
							RelatedFase: !isFromLastPg ? oParams.aRelatedPosFin[i].FASE : oParams.aRelatedPosFin[i].Fase,
							RelatedReale: !isFromLastPg ? oParams.aRelatedPosFin[i].REALE : oParams.aRelatedPosFin[i].Reale,
							RelatedVersione: !isFromLastPg ? oParams.aRelatedPosFin[i].VERSIONE : oParams.aRelatedPosFin[i].Versione,
							RelatedFipex: !isFromLastPg ? oParams.aRelatedPosFin[i].FIPEX : oParams.aRelatedPosFin[i].Fipex,
							RelatedDatbis: !isFromLastPg ? new Date(new Date(`${dataFine.slice(0,4)}-${dataFine.slice(4,6)}-${dataFine.slice(6,8)}T01:00:00`)) : new Date(oParams.aRelatedPosFin[i].Datbis),
							//RelatedDatbis: new Date(oParams.aRelatedPosFin[i].Datbis),
						})
					}
						return aArray	
				}(),
				UpdateCambioPosfin : oParams.UpdateCambioPosfin[0],
				UpdateSstrLog: oParams.UpdateSstrLog
			}

			if(checkControlli){		
				
				oPayload.Ce2 = oDetailAnagrafica.CE2
				oPayload.Ce3 = oDetailAnagrafica.CE3
				oPayload.Missione = oDetailAnagrafica.MISSIONE
				oPayload.Programma = oDetailAnagrafica.PROGRAMMA
				oPayload.Azione = oDetailAnagrafica.AZIONE
				oPayload.Ragioneria = oDetailAnagrafica.RAG
				oPayload.Titolo = oDetailAnagrafica.TITOLO
				oPayload.Categoria = oDetailAnagrafica.CATEGORIA
				

				delete oPayload.Devoluzione
				delete oPayload.UpdateAmmCapPg
				delete oPayload.UpdateCapitoloElenco
				delete oPayload.DistribuzioneCofog
				delete oPayload.UpdateTipCapitolo
				delete oPayload.UpdateRelatedPosfin
				delete oPayload.UpdateCambioPosfin
				delete oPayload.UpdateSstrLog
				delete oPayload.UpdatePosFinIrap
				
			}
			return oPayload
			
		},
		createPayloadFoglioNotizie: function (oParams) {
			

			const oDetailAnagrafica = oParams.oDetailAnagrafica
			let capitoliElenchi = JSON.parse(JSON.stringify(oDetailAnagrafica.elenchiCapitolo))
			let aDistrCofog = JSON.parse(JSON.stringify(oDetailAnagrafica.elencoCOFOG))
			let aPosIrap = JSON.parse(JSON.stringify(oDetailAnagrafica.PosizioneFinanziariaIrap))
			const oPosFin = oParams.oPosFin	
			const that = oParams.that
			const oInfoSttr = oParams.oInfoSottostrumento
			const recPosFin = oParams.recPosFin[0]
			const campiMod = oParams.campiModificati

			var bDate = new Date();
			var sStringData = this.formatter.formatterDatePatter(bDate, 0);
			const oAnno = that.getOwnerComponent().getModel("globalModel").getData().ANNO
			var foglio = {
				"MANDT": "",
				"FIKRS": "S001",
				"ANNO": oAnno,
				"FASE": "NV",
				"REALE": "R",
				"VERSIONE": "B",
				"DATBIS": "99991231",
				"NUMERO_FN": "",
				"STATO_FN": "02",
				"STATO_FN_DESC": "In Revisione",
				"TIPO_OPERAZ": "M",
				"TIPO_WF": "1",
				"CODICE_STRUMENTO": oInfoSttr.CodiceStrumento,
				"CODICE_STRUMENTO_ORI":  oInfoSttr.CodiceStrumentoOri,
				"CODICE_SOTTOSTRUMENTO":  oInfoSttr.CodiceSottostrumento,
				"ANNO_SSTR": oInfoSttr.AnnoSstr,
				"NUMERO_STR": oInfoSttr.NumeroStr,
				"NUMERO_SSTR": oInfoSttr.NumeroSstr,
				"DESC_SIGLA_STRUMENTO": "PLB",
				"DESC_SIGLA_SOTTOSTRUMENTO": "VLV",
				"TIPO_SSTR": oInfoSttr.TipoSstr,
				"TIPO_STR": oInfoSttr.TipoStr,
				"EOS": "S",
				"DESC_BREVE_FN": "",
				"DESCR_ESTESA_FN": "Creato automaticamente da Gestione Posizione Finanziaria",
				"ATTIVO": "",
				"DATAB": sStringData,
				"LOEKZ": "",
				"DATA_LOEKZ": "00000000",
				"ERSDA": sStringData,
				"CREATED_AT_TIME": that.formatter.formatterDateForDB(bDate),
				"ERNAM": this.getUserInfo("Id"),
				"LAEDA": "",
				"TIPO_WF_DESC": "Standard",
				"AENAM": "",
				"CDCHNGIND": "I",
				"NAV_POSFIN": []
			}

			var wf = {
				"FIKRS": "S001",
				"ANNO": oAnno,
				"FASE": "NV",
				"REALE": "R",
				"VERSIONE": "B",
				"NUMERO_FN": "",
				"EOS": "S",
				"DATBIS": "99991231",
				"STATO_FN": "02"
			}

			/* 
			"NAV_IRAP": ["CDCHNGIND": "I",FIPEX : "000000000000000000001010",],
			*/
			let aIrap = [];
			for(let i = 0 ; i < aPosIrap.length ; i ++){
				let currentIrap = aPosIrap[i]
				let irap = {
					"CDCHNGIND": "I",
					"FIPEX" : currentIrap.Fipex
				}	
				aIrap.push(irap)
				//CODIFICA_REP_PF: "5651.456.8465"
			}

				//controllo le irap eliminate
				const aIrapOriginali = oParams.aIrapOrigi
				for(let i = 0 ; i < aIrapOriginali.length ; i++){
					let irapOrig = aIrapOriginali[i]
					let oFindIrap = []
					oFindIrap = aPosIrap.filter(el => (
						el.Fipex === irapOrig.Fipex
						)
					)
					if(oFindIrap.length === 0){
						aCofog.push({
							"CDCHNGIND": "D",
							"FIPEX" : irapOrig.Fipex,
							"LOEKZ":  "X", //se non + presente lo devo cancellare
						}	)
					}
				}
			
			
				let aCofog = []
				for(let i = 0 ; i < aDistrCofog.length ; i ++){
					let currentCofog = aDistrCofog[i]					
					let cofog = that.__createCofogFoglio(currentCofog, sStringData, oPosFin.Fipex, oAnno)
					aCofog.push(cofog)
			}				 
			//controllo cofog eliminati
			const aCofogOriginali = oParams.aCofogOrigi
			for(let i = 0 ; i < aCofogOriginali.length ; i++){
				let cofogOrigi = aCofogOriginali[i]
				let oFindCofog = []
				oFindCofog = aDistrCofog.filter(el => (
					el.CofogL1 === cofogOrigi.CofogL1 &&
					el.CofogL2 === cofogOrigi.CofogL2 &&
					el.CofogL3 === cofogOrigi.CofogL3 
					)
				)
				if(oFindCofog.length === 0){
					aCofog.push(that.__createCofogFoglio(cofogOrigi, sStringData, oPosFin.Fipex, oAnno, true))
				}
			}

			let aElenchi = []
				for(let i = 0 ; i < capitoliElenchi.length ; i ++){
					let currentElenco = capitoliElenchi[i]		
					let elenco = that.__createElencoFoglio(oAnno, currentElenco, oDetailAnagrafica ,sStringData, bDate)			
								
				aElenchi.push(elenco)
			}
			const aElenchiOriginali = oParams.aElenchiOrigi
			for(let i = 0 ; i < aElenchiOriginali.length ; i++){
				let currentElencoCap = aElenchiOriginali[i]
				let oFindElenco = []
				oFindElenco = aElenchiOriginali.filter(el => (el.Fikrs == currentElencoCap.Fikrs &&
					el.Anno == currentElencoCap.Anno &&
					el.Fase == currentElencoCap.Fase &&
					el.Reale == currentElencoCap.Reale &&
					el.Versione == currentElencoCap.Versione &&
					el.Eos == currentElencoCap.Eos &&
					el.Prctr == currentElencoCap.Prctr &&
					el.Capitolo == currentElencoCap.Capitolo &&
					el.Pg == currentElencoCap.Pg &&
					el.PrctrElenco == currentElencoCap.PrctrElenco &&
					el.NumeroElenco == currentElencoCap.NumeroElenco 
					)
					)
				if(oFindElenco.length === 0) {
					aElenchi.push(that.__createElencoFoglio(oAnno, currentElenco, oDetailAnagrafica, sStringData, bDate, true))
				}
			}


			//! creo il modello vero e proprio secondo le info ricevute
			var NAV_POSFIN = {
				"MANDT": "",
				"FIKRS": "S001",
				"ANNO": oAnno,
				"FASE": "NV",
				"REALE": "",
				"VERSIONE": "B",
				"FIPEX": oPosFin.Fipex,
				"DATBIS": "99991231",
				"EOS": "S",
				"ATTIVO": "X",
				"DATAB": sStringData,
				"LOEKZ": "",
				"DATA_LOEKZ": "00000000",
				"ERSDA": sStringData,
				"CREATED_AT_TIME": that.formatter.formatterDateForDB(bDate),
				"ERNAM": this.getUserInfo("Id"),
				"LAEDA": sStringData,
				"AENAM": "",
				"CODICE_CAPITOLO": oDetailAnagrafica.CAPITOLO,
				"CODICE_PG": oDetailAnagrafica.pg,
				"CODICE_AMMIN": oDetailAnagrafica.AMMINISTAZIONE.slice(1), //da capire quale mandare
				"CODICE_MISSIONE": campiMod.Missione ? oDetailAnagrafica.MISSIONE : recPosFin.CODICE_MISSIONE ,
				"CODICE_PROGRAMMA": campiMod.Programma ? oDetailAnagrafica.PROGRAMMA : recPosFin.CODICE_PROGRAMMA ,
				"CODICE_AZIONE": campiMod.Azione ? oDetailAnagrafica.AZIONE : recPosFin.CODICE_AZIONE ,
				"CODICE_CATEGORIA": oDetailAnagrafica.CATEGORIA,
				"CODICE_CLAECO2": oDetailAnagrafica.CE2,
				"CODICE_CLAECO3": oDetailAnagrafica.CE3,
				"CODICE_TITOLO": oDetailAnagrafica.TITOLO,
				"CODICE_NATURA": "00",
				"CODICE_TIPOLOGIA": "00",
				"CODICE_PROVENTO": oPosFin.Provento,
				"PRCTR": oDetailAnagrafica.AMMINISTAZIONE,
				"CODICE_CDR": oDetailAnagrafica.CDR,
				"CODICE_RAGIONERIA": oDetailAnagrafica.RAG,
				"CODICE_AZIONE_ORDINATA": recPosFin.CODICE_AZIONE_ORDINATA,
				"FLAG_MEMCOR_01": oDetailAnagrafica.Memoria ? "X" : "",
				"STATUS_CAPITOLO": oDetailAnagrafica.StatusCapitolo === false ? "3" : (oPosFin.StatusCapitolo === "3" && oDetailAnagrafica.StatusCapitolo === true ? (oDetailAnagrafica.VersioneCapitolo === "D" ? "1" : "0") : oPosFin.StatusCapitolo),
				"CODICE_UDV_LIV1_SPE": oDetailAnagrafica.UdvL1,
				"CODICE_UDV_LIV2_SPE": oDetailAnagrafica.UdvL2,
				"NUME_MAC_SPE": oDetailAnagrafica.MAC,
				"STAT_TIPOFON_SPE": oDetailAnagrafica.tipoFondo,
				"DESCR_TIPO_FONDO": "",
				"FLAG_INIBITO_SPESE": recPosFin.FLAG_INIBITO_SPESE,
				"CODICE_TIPOLOGIA_CAP_SPE": recPosFin.CODICE_TIPOLOGIA_CAP_SPE,
				"CAPITOLONE_SPE": oDetailAnagrafica.Capitolone ? "X" : "",
				"FLAG_CU_01_SPE": oDetailAnagrafica.CuIrapNoncu,
				"NOI_PA_SPE": oDetailAnagrafica.Noipa,
				"FIPEX_IRAP_SPE": recPosFin.FIPEX_IRAP_SPE,
				"CODICE_TIPOSP_P_SPE": oDetailAnagrafica.TipoSpesaPg,				
				"CODICE_TIPOSP_CAP_SPE": oDetailAnagrafica.tipoSpesaCapitolo,
				"CODI_AREE_SPE": oDetailAnagrafica.AreaDestinataria ? oDetailAnagrafica.AreaDestinataria : "",
				"FLAG_OB_MIN_01_SPE": oDetailAnagrafica.ObiettiviMinisteri ? "X" : "",
				"PERC_AGGRED_P_SPE": "0.00",
				"CODI_FOFP_SPE": oDetailAnagrafica.FOFP,
				"CODI_RSF_SPE": oDetailAnagrafica.RuoliSpesaFissa ? "X" : "",
				"STAT_STATUS": oDetailAnagrafica.StatusPg === false ? "3" : ((oPosFin.StatusPg === "3" && oDetailAnagrafica.StatusPg === true) ? (oDetailAnagrafica.VersionePg === "D" ? "1" : "0") : oPosFin.StatusPg),
				"GESTIONE_UNIFICATA": recPosFin.GESTIONE_UNIFICATA,
				"CODIFICA_REP_PF": oPosFin.CodificaRepPf,
				"DESC_BREVE": "",
				"DESCR_ESTESA": "",
				"FLAG_VIS_COAN": recPosFin.FLAG_VIS_COAN,
				"FLAG_VIS_SPE": recPosFin.FLAG_VIS_SPE,
				"FLAG_VIS_ENT": recPosFin.FLAG_VIS_ENT,
				"NUME_COD_DETT_CAPO_ENT": "",
				"DESCR_ESTESA_NDC": "",
				"DESC_BREVE_NDC": "",
				"STAT_TIPO_GEST_ENT": recPosFin.STAT_TIPO_GEST_ENT,
				"STAT_TIPO_INT_IMPOSTA_ENT": recPosFin.STAT_TIPO_INT_IMPOSTA_ENT,
				"FLAG_F24_01_ENT": recPosFin.FLAG_F24_01_ENT,
				"FLAG_RIS_CONC_01_ENT": recPosFin.FLAG_RIS_CONC_01_ENT,
				"FLAG_VERS_01_ENT": recPosFin.FLAG_VERS_01_ENT,
				"FLAG_F23_01_ENT": recPosFin.FLAG_F23_01_ENT,
				"FLAG_PAGOPA_01_ENT": recPosFin.FLAG_PAGOPA_01_ENT,
				"FLAG_CONTSPEC_01_ENT": recPosFin.FLAG_CONTSPEC_01_ENT,
				"FLAG_CONTCORR_01_ENT": recPosFin.FLAG_CONTCORR_01_ENT,
				"FLAG_AGCONT_01_ENT": recPosFin.FLAG_AGCONT_01_ENT,
				"FLAG_UE_01_ENT": recPosFin.FLAG_UE_01_ENT,
				"FLAG_DEV_REG_01_ENT": recPosFin.FLAG_DEV_REG_01_ENT,
				"FLAG_DOGANALI_01_ENT": recPosFin.FLAG_DOGANALI_01_ENT,
				"CODICE_CAPITOLO_INT_ENT": "0000",
				"CODICE_ARTICOLO_INT_ENT": "00",
				"CODICE_UDV_LIV1_ENT": recPosFin.CODICE_UDV_LIV1_ENT,
				"CODICE_UDV_LIV2_ENT": recPosFin.CODICE_UDV_LIV2_ENT,
				"CODICE_UDV_LIV3_ENT": recPosFin.CODICE_UDV_LIV3_ENT,
				"FLAG_SPE_BDG": recPosFin.FLAG_SPE_BDG,
				"FLAG_PERS_BDG": recPosFin.FLAG_PERS_BDG,
				"FLAG_SPE_ECO": recPosFin.FLAG_SPE_ECO,
				"ESITO_ECO": recPosFin.ESITO_ECO,
				"ESITO_ECO_PERC": recPosFin.ESITO_ECO_PERC,
				"MULTIAMBITO": recPosFin.MULTIAMBITO,
				"SPESE_INTERNE": recPosFin.SPESE_INTERNE,
				"COD_QCSS_L1": oPosFin.CodQcssL1,
				"COD_QCSS_L2": oPosFin.CodQcssL2,
				"COD_QCSS_L3": oPosFin.CodQcssL3,
				"QCSS_L1_DESC": "",
				"QCSS_L2_DESC": "",
				"QCSS_L3_DESC": "",
				"DESC_BREVE_CAT": campiMod.Categoria ? oDetailAnagrafica.DESC_CATEGORIA : recPosFin.DESC_BREVE_CAT,
				"DESCR_ESTESA_CAT": campiMod.Categoria ? oDetailAnagrafica.DESC_CATEGORIA : recPosFin.DESCR_ESTESA_CAT,
				"DESC_BREVE_CE2": "",
				"DESCR_ESTESA_CE2": campiMod.CE2 ? oDetailAnagrafica.DESC_CE2 : recPosFin.DESC_BREVE_CE2,
				"DESC_BREVE_CE3":  "",
				"DESCR_ESTESA_CE3":  campiMod.CE3 ? oDetailAnagrafica.DESC_CE3 : recPosFin.DESC_BREVE_CE3,
				"DESCR_ESTESA_TIP": "",
				"DESC_BREVE_TIP": "",
				"DESCR_ESTESA_PROG": oDetailAnagrafica.DESC_PROGRAMMA,
				"DESC_BREVE_PROG": "",
				"DESC_BREVE_TIT": "",
				"DESCR_ESTESA_TIT": "", //oDetailAnagrafica.DESC_TITOLO
				"DESC_BREVE_MIS": "",
				"DESCR_ESTESA_MIS": "", //oDetailAnagrafica.DESC_MISSIONE
				"DESC_BREVE_AZI": "",
				"DESCR_ESTESA_AZI": "", //oDetailAnagrafica.DESC_MISSIONE
				"DESC_BREVE_AMM": recPosFin.DESC_BREVE_AMM,
				"DESCR_ESTESA_AMM": recPosFin.DESCR_ESTESA_AMM,
				"DESC_BREVE_CDR": "",
				"DESCR_ESTESA_CDR": "", //campiMod.Cdr ? oDetailAnagrafica.Cdr : recPosFin.DESCR_ESTESA_CDR
				"DESC_BREVE_RAG": "",
				"DESCR_ESTESA_RAG": "", //oDetailAnagrafica.DESC_RAG
				"DESCR_ESTESA_NUME_MAC_SPE": "", //oDetailAnagrafica.DESC_MAC
				"DESC_BREVE_NUME_MAC_SPE": "",
				"DENOM_RIDOTTA_CAP": oDetailAnagrafica.CD_CAPITOLO_DEN_BREVE,
				"DENOM_INTEGRALE_CAP": oDetailAnagrafica.CD_CAPITOLO_DEN_EST,
				"CODICE_STANDARD_CAP": !oDetailAnagrafica.CODICE_STANDARD_CAPITOLO ? '' : oDetailAnagrafica.CODICE_STANDARD_CAPITOLO,
				"DENOM_RIDOTTA_PG": oDetailAnagrafica.CD_PG_DEN_BREVE,
				"DENOM_INTEGRALE_PG": oDetailAnagrafica.CD_PG_DEN_EST,
				"CODICE_STANDARD_PG": !oDetailAnagrafica.CODICE_STANDARD_PG ? '' : oDetailAnagrafica.CODICE_STANDARD_PG,
				"NATURA_SPESA" : oDetailAnagrafica.CodiceNaturaSpesa,
				"CDCHNGIND": "A",
				"NAV_ELENCHI": aElenchi,
				"NAV_COFOG": aCofog,
				"NAV_IRAP" : aIrap,
				"NAV_REVUFF": [
						]
					
			}	

			//effettuo anche il payload delle nav correlate
			//! LT -> modifico quì le pos fin correlate 
			oParams.aRelatedPosFin = !oParams.isModifcaCap ? [] : that.__modificaPosFinCorrelate(oParams.aRelatedPosFin, oParams.campiModificati,oDetailAnagrafica, aCofog, NAV_POSFIN, oParams.modificaCe2Ce3)

			const ritorno = {foglio:foglio,wf:wf, NAV_POSFIN : NAV_POSFIN}
			return ritorno
			
		},
		__modificaPosFinCorrelate: function(aRelatedPosFin, campiModificati, oDetailAnagrafica,aCofog, NAV_POSFIN, modificaCe2Ce3){
			
			//lt elimino 
			const propertyPayload = Object.keys(NAV_POSFIN)

			aRelatedPosFin.forEach(pos => {
				const objProperties = Object.keys(pos)
				for (let i = 0; i < objProperties.length; i++) {
					const property = objProperties[i];
					
					if (propertyPayload.indexOf(property) === -1) {
						delete pos[property]
					}	
				}
			});

			let posFinArray = []
			for (let i = 0; i < aRelatedPosFin.length; i++) {
				const posFin = aRelatedPosFin[i];

				if(campiModificati.Cdr){
					posFin.CODICE_CDR = oDetailAnagrafica.CDR
					posFin.DESCR_ESTESA_CDR = ""
				}
				if(campiModificati.Missione){
					posFin.CODICE_MISSIONE = oDetailAnagrafica.MISSIONE
					posFin.DESCR_ESTESA_MIS = ""
					posFin.DESC_BREVE_MIS = ""
				}
				if(campiModificati.Programma){
					posFin.CODICE_PROGRAMMA = oDetailAnagrafica.PROGRAMMA
					posFin.DESCR_ESTESA_PROG = ""
					posFin.DESC_BREVE_PROG = ""
				}
				if(campiModificati.Azione){
					posFin.CODICE_AZIONE = oDetailAnagrafica.AZIONE
					posFin.DESC_BREVE_AZI = ""
					posFin.DESCR_ESTESA_AZI = ""
				}
				if(campiModificati.Titolo){
					posFin.CODICE_TITOLO = oDetailAnagrafica.TITOLO
					posFin.DESCR_ESTESA_TIT = ""
					posFin.DESC_BREVE_TIT = ""
				}
				if(campiModificati.Categoria){
					posFin.CODICE_CATEGORIA = oDetailAnagrafica.CATEGORIA
					posFin.DESC_BREVE_CAT = ""
					posFin.DESCR_ESTESA_CAT = ""
				}
				if(modificaCe2Ce3){
					posFin.CODICE_CLAECO2 = oDetailAnagrafica.CE2
					posFin.DESCR_ESTESA_CE2 = ""
					posFin.DESC_BREVE_CE2 = ""
				
					posFin.CODICE_CLAECO3 = oDetailAnagrafica.CE3
					posFin.DESCR_ESTESA_CE3 = ""
					posFin.DESC_BREVE_CE3 = ""
				}				
				//!lt adeguo anche le altre pos fin con la pos fin padre
				posFin.CODICE_CAPITOLO = oDetailAnagrafica.CAPITOLO
				//posFin.CODICE_PG = oDetailAnagrafica.pg
				posFin.CODICE_RAGIONERIA = oDetailAnagrafica.RAG
				posFin.NUME_MAC_SPE = oDetailAnagrafica.MAC
				posFin.STAT_TIPOFON_SPE = oDetailAnagrafica.tipoFondo
				posFin.CODICE_TIPOSP_CAP_SPE = oDetailAnagrafica.tipoSpesaCapitolo
				posFin.FLAG_CU_01_SPE = oDetailAnagrafica.CuIrapNoncu				
				posFin.FLAG_MEMCOR_01 = oDetailAnagrafica.Memoria ? "X" : ""
				posFin.CAPITOLONE_SPE = oDetailAnagrafica.Capitolone ? "X" : ""
				posFin.NOI_PA_SPE = oDetailAnagrafica.Noipa
				posFin.NATURA_SPESA = oDetailAnagrafica.CodiceNaturaSpesa
				//posFin.STATUS_CAPITOLO = oDetailAnagrafica.StatusCapitolo === false ? "3" : (oPosFin.StatusCapitolo === "3" && oDetailAnagrafica.StatusCapitolo === true ? (oDetailAnagrafica.VersioneCapitolo === "D" ? "1" : "0") : oPosFin.StatusCapitolo)
				//lt! aggiunta
				delete posFin.NUME_TCRC_SPE
				delete posFin.NUME_TCRF_SPE
				
				//delete posFin.NATURA_SPESA
				delete posFin.A1_BKI_IBAN_COMPETENZA
				delete posFin.A1_BKI_IBAN_RESIDUI
				delete posFin.A1_FLAG_CHECK_CRONO
				delete posFin.A1_PAT_FLAG_RPP
				delete posFin.ST_TIPO_IST_CAP
				delete posFin.STAT_TIPO_IST_PG_ART
				delete posFin.FICTR
				delete posFin.DESC_PG
				//delete posFin.DESC_IRAP_SPE
				//delete posFin.DESC_AREE_SPE
				delete posFin.DESC_BREVE_TF
				delete posFin.DESCR_ESTESA_TF
				delete posFin.CODICE_STRUMENTO
				delete posFin.CODICE_STRUMENTO_ORI
				delete posFin.CODICE_SOTTOSTRUMENTO
				delete posFin.DESC_SIGLA
				delete posFin.SEM_OBJ
				delete posFin.DESC_PG_SPE
				delete posFin.NO_SEGREG
				delete posFin.ACTIVITY
				delete posFin.NAV_FINCODE
				

				posFin.MANDT = ""
				posFin.EOS = "S"
				posFin.DESCR_TIPO_FONDO = ""
				posFin.DESCR_ESTESA_NDC = ""
				posFin.DESC_BREVE_NDC = ""
				posFin.QCSS_L1_DESC = ""
				posFin.QCSS_L2_DESC = ""
				posFin.QCSS_L3_DESC = ""
				posFin.DESCR_ESTESA_TIP = ""
				posFin.DESC_BREVE_TIP = ""
				posFin.DESC_BREVE_TIT = ""
				posFin.NAV_REVUFF = []

				
				//lt gestisco altri campi che avevo recuperato in precedenza 	
				posFin.VERSIONE = "B"
				posFin.CDCHNGIND = "I"
				posFin.NAV_COFOG = this.__modificaCofog(jQuery.extend(true, [], aCofog), posFin) 
				posFin.NAV_ELENCHI = []
				//posFin.NAV_FINCODE = []
				posFin.NAV_IRAP = []
				delete posFin.__metadata
				posFinArray.push(posFin)
			}

			return posFinArray
		},
		__modificaCofog : function(aCofog, posFin){
			aCofog.forEach(cofog => {
				cofog.FIPEX = posFin.FIPEX
			});

			return aCofog
		},
		__createElencoFoglio: function(oAnno, currentElenco, oDetailAnagrafica, sStringData, bDate, isDelete){
			return {
				"FIKRS": "S001",
				"ANNO": oAnno,
				"FASE": "NV",
				"REALE": "",
				"VERSIONE": "B",
				"EOS": "S",
				"PRCTR": oDetailAnagrafica.AMMINISTAZIONE,
				"CODICE_CAPITOLO": oDetailAnagrafica.CAPITOLO,
				"CODICE_PG": currentElenco.Pg,
				"PRCTR_ELENCO": currentElenco.PrctrElenco,
				"NUMERO_ELENCO": "001",
				"DATBIS": "99991231",
				"ATTIVO": "",
				"DATAB": sStringData,
				"LOEKZ": !isDelete ? "" : "X",
				"DATA_LOEKZ": "00000000",
				"ERSDA": sStringData,
				"CREATED_AT_TIME": this.formatter.formatterDateForDB(bDate),
				"ERNAM": this.getUserInfo("Id"),
				"LAEDA": "",
				"AENAM": "",
				"CDCHNGIND": "I",
		}		
		// !isDelete ? "I" : "D"
		},
		__createCofogFoglio: function(currentCofog, sStringData, Fipex, oAnno, isDelete){
			currentCofog.PercCofog = currentCofog.PercCofog.toString()
			return {
				"AENAM": "",
				"ANNO": oAnno,
				"ATTIVO": "",
				"CDCHNGIND": "I", // !isDelete ? "I" : "D"
				"COD_COFOG_L1": currentCofog.CofogL1,
				"COD_COFOG_L2": currentCofog.CofogL2,
				"COD_COFOG_L3": currentCofog.CofogL3,
				"COD_CONCATENATO": `${currentCofog.CofogL1}${currentCofog.CofogL2}${currentCofog.CofogL3}`,
				"DATAB": sStringData,
				"DATA_LOEKZ": "00000000",
				"DATBIS": "99991231",
				"ERNAM": "",
				"ERSDA": "",
				"FASE": "NV",
				"FIKRS": "S001",
				"FIPEX": Fipex,
				"LAEDA": "",
				"PERC_COFOG": currentCofog.PercCofog.indexOf(".") === -1 ? currentCofog.PercCofog + ".00" : currentCofog.PercCofog,
				"REALE": "",
				"LOEKZ": !isDelete ? "" : "X",
				"VERSIONE": "B"
		}		
		},
		__onSaveModifyToDB: async function (oParams) {
			var allOk = false;
			if(oParams.state && oParams.onOk  && (oParams.checkChiaviCambio || oParams.checkModifyCapitolo || oParams.checkModifyPG)) {
				allOk = true
			}

			if(oParams.isFoglioNotizie && allOk){
				//if(allOk){
					console.log("LT: Passo per FOGLIO");
					console.log(oParams.oPayload);	
					const modelFoglio = oParams.modelFoglio
					let oPayload = oParams.oPayload
					const that = oParams.that
					let responseFn = await that.__setDataPromiseSave( "/ZES_FN_PF_SET" ,modelFoglio, oParams, oPayload.foglio)
					if(!responseFn.success){
						responseFn.message = "Errore nella creazione del Foglio Notizie"
						
						return responseFn
					}
					let foglio = responseFn.entity
					oPayload.wf.NUMERO_FN = foglio.NUMERO_FN
					oPayload.foglio.NUMERO_FN = foglio.NUMERO_FN
					oPayload.wf.CDCHNGIND = ""
					let responseWf = await that.__setDataPromiseSave( "/ZES_WF_FNFP_SET" ,modelFoglio, oParams, oPayload.wf)
					if(!responseWf.success){
						responseWf.message = "Errore nella creazione del Work Flow Foglio Notizie"
						
						return responseWf
					}
					//! LT IMPOSTO ANCHE NELLE ALTRE ENTITY IL FOGLIO NOTIZIE PER LEGARLE					
					oPayload.foglio.CDCHNGIND = ""
					oPayload.foglio.NAV_POSFIN = [oPayload.NAV_POSFIN,...oParams.aRelatedPosFin]
					oPayload.foglio.NAV_POSFIN.forEach(posfin => {

						posfin.REALE = foglio.NUMERO_FN
						posfin.NAV_ELENCHI.forEach(elenco => {
							elenco.REALE = foglio.NUMERO_FN
							elenco.CDCHNGIND = "I"
						});
						posfin.NAV_COFOG.forEach(cofog => {
							cofog.REALE = foglio.NUMERO_FN
							cofog.CDCHNGIND = "I"
						});
						
					});
					let responsePfSaved = await that.__setDataPromiseSave( "/ZES_FN_PF_SET" ,modelFoglio, oParams, oPayload.foglio)					
					if(!responsePfSaved.success){
						console.log("LT Foglio notizie: Chiamata in Errore:");
						console.log(responsePfSaved);
						responsePfSaved.message = "Errore nel salvataggio della Posizione Finanziaria nel foglio notizie"
						return responsePfSaved
					}

					/* for (let i = 0; i < oPayload.foglio.NAV_POSFIN.length; i++) {
						let posFin = oPayload.foglio.NAV_POSFIN[i]
						//!lt se arrivo quì devo scrivere il crono
						var pl = {
							"Fikrs" : foglio.FIKRS,
							"Anno" : foglio.ANNO,
							"Fase" : foglio.FASE,
							"Reale" : posFin.REALE,
							"Versione" : posFin.VERSIONE,
							"Fipex" : posFin.FIPEX,
							"Datbis" : that.nuovaDataFN(posFin.DATBIS),
							//"Eos" : foglio.EOS,
							"CodiceCapitolo" : posFin.CODICE_CAPITOLO,
							"CodicePg" : posFin.CODICE_PG,
							"Prctr" : posFin.PRCTR,
							"StatStatus" : posFin.STAT_STATUS,
							"CodiceStrumento" : foglio.CODICE_STRUMENTO,
							"CodiceStrumentoOri" : foglio.CODICE_STRUMENTO_ORI,
							"CodiceSottostrumento" : foglio.CODICE_SOTTOSTRUMENTO,
							"NumeroFn" : foglio.NUMERO_FN
						}						

						var aFilters = []
						Object.keys(pl).forEach(prop => {
							aFilters.push(new Filter(prop, FilterOperator.EQ, pl[prop]))
						});
					
						try {							
							let responseCrono = await that.__getDataPromise("/CronoPosfinFnSet", aFilters , oParams.modelHana , {})
						} catch (error) {
							console.log("LT Errore scrittura Cronologico",error);
						}
					} */

					console.log("LT Foglio notizie: Chiamata Corretta:");
						console.log(responsePfSaved);
					
					return {
						isFoglioNotizie: true,
						posFin: responsePfSaved.entity,
						checkChiaviCambio: oParams.checkChiaviCambio,
						status: 200,
						state: true,
						typeMessage: "success",
						message: `Foglio notizie n:${responsePfSaved.entity.NUMERO_FN.slice(1)} creato con successo.\nLa posizione finanziaria non si potrà più modificare finchè il foglio notizie non verrà approvato`,
						that : oParams.that,
						modelPosFin: oParams.modelPosFin,
						onOk: true
					}
				//}

			}else{		
				return new Promise((resolve, reject) => {
					if(allOk) {
						console.log("LT: Passo per ALV");
						console.log(oParams.oPayload);					
											
						
						oParams.modelHana.create("/PosizioneFinanziariaSet", oParams.oPayload, {
							success: (oData, res) =>{
								const resol = {
									posFin: oData,
									checkChiaviCambio: oParams.checkChiaviCambio,
									status: 200,
									typeMessage: "success",
									message: "Salvataggio effettuato correttamente",
									that : oParams.that,
									modelPosFin: oParams.modelPosFin,
									onOk: true
								}							
								resolve(resol)
							},
							error: (err) => {
								resolve({
									posFin: oParams.oPosFin,
									status: err.statusCode,
									checkChiaviCambio: oParams.checkChiaviCambio,
									typeMessage: "error",
									message:  (() =>{
										try {
											let oParsedReturn = JSON.parse(err.responseText)
											return oParsedReturn.error.message.value
										} catch (e) {
											return err.statusText
										}
									})(),
									that : oParams.that,
									modelPosFin: oParams.modelPosFin,
									onOk: true
								})
							}
						}) 
					} else {
						//lt imposto il messaggio di annullamento nel caso sia stato premuto il pulsante annulla sul mesasge box
						if(oParams.modelPosFin.getProperty("/PressAnnulla")) oParams.message = 'Salvataggio annullato'	
						oParams.modelPosFin.setProperty("/PressAnnulla", false)				
						//oParams.isFoglioNotizie = false
						resolve({
							...oParams,
							posFin: oParams.oPosFin,
							that : oParams.that,
							onOk: true
						})
					}
				})
			}
		},
		__setNegativeResolve(res){
			//!TODO fare il resolve per renderlo 'generale'
		},
		__setBusyFalse: async function (oParams) {

			const that = oParams.that
			if(that.unlock) await that.resetLock()

			if(!oParams.typeMessage) oParams.typeMessage = "information"
			if(!oParams.message) oParams.message = "Nussuna modifica effettuata"

			if(oParams.onOk)
			if(oParams.isFoglioNotizie && oParams.state){
				return new Promise(function(resolve, reject) {
					MessageBox.show(
						`${oParams.message}, Si verrà reindirizzati nella sezione ricerca posizione finanziaria`, {
							icon: MessageBox.Icon.SUCCESS,
							title: "Salvataggio",
							actions: [MessageBox.Action.OK],
							emphasizedAction: MessageBox.Action.OK,
							onClose: function (oAction) { 
								
									resolve({
										...oParams
									})
								
							}
						}
					);
			});

			}else{
				MessageBox[oParams.typeMessage](oParams.message)
				oParams.that.getView().setBusy(false)
				return {
					...oParams
				}
			}
		},
		__navToPosFin: async function (oParams) {
			let that = oParams.that
			let oRouter = that.getOwnerComponent().getRouter()//that.getOwnerComponent().getRouterFor(oParams.that)
			let modelPosFin = oParams.modelPosFin
			let oPosFin = oParams.posFin
			
			if(oParams.isFoglioNotizie){
				if(!oParams.state){
					return
				}
				that.onReimpostaPosFin()
				return
			}

			if(oParams.errorCheck){
				console.log("LT non effettuo il refresh");
				return
			}
		
			if(oParams.checkChiaviCambio && oParams.status === 200){
				if(that.unlock) await that.unLockPosFin();
				oRouter.navTo("DetailPosFin", {
						Fikrs: modelPosFin.getProperty("/infoSottoStrumento/Fikrs"),
						CodiceStrumento: modelPosFin.getProperty("/infoSottoStrumento/CodiceStrumento"),
						CodiceStrumentoOri: modelPosFin.getProperty("/infoSottoStrumento/CodiceStrumentoOri"),
						CodiceSottostrumento: modelPosFin.getProperty("/infoSottoStrumento/CodiceSottostrumento"),
						Datbis: modelPosFin.getProperty("/infoSottoStrumento/Datbis").toISOString(),
						Anno: oPosFin.Anno,
						Fase: oPosFin.Fase,
						Reale: oPosFin.Reale,
						Fipex: oPosFin.Fipex,
					});	
			}else{
				if(oPosFin){
					if(that.unlock) await that.unLockPosFin();
					that._onObjectMatched(null, {
						Fikrs: modelPosFin.getProperty("/infoSottoStrumento/Fikrs"),
						CodiceStrumento: modelPosFin.getProperty("/infoSottoStrumento/CodiceStrumento"),
						CodiceStrumentoOri: modelPosFin.getProperty("/infoSottoStrumento/CodiceStrumentoOri"),
						CodiceSottostrumento: modelPosFin.getProperty("/infoSottoStrumento/CodiceSottostrumento"),
						Datbis: modelPosFin.getProperty("/infoSottoStrumento/Datbis").toISOString(),
						Anno: !oParams.isFoglioNotizie ? oPosFin.Anno : oPosFin.NAV_POSFIN.results[0].ANNO,
						Fase: !oParams.isFoglioNotizie ? oPosFin.Fase : oPosFin.NAV_POSFIN.results[0].FASE,
						Reale: !oParams.isFoglioNotizie ? oPosFin.Reale : oPosFin.NAV_POSFIN.results[0].REALE,
						Fipex: !oParams.isFoglioNotizie ? oPosFin.Fipex : oPosFin.NAV_POSFIN.results[0].FIPEX})				

				}
			}
			
			

		},
		onSaveModifica: function (oEvent) {
			oEvent.getSource().getParent().close()
			oEvent.getSource().getParent().destroy()
			const modelPosFin = this.getView().getModel("modelPosFin")
			this.__saveModifyPosFin(modelPosFin.getProperty("/payloadModifica"))
		},
		__saveModifyPosFin: function (payload) {
			const modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			const modelPosFin = this.getView().getModel("modelPosFin")
			
			modelHana.create("/PosizioneFinanziariaSet" ,payload, {
				success: (oData) => {
					this.getView().setBusy(false)
					MessageBox.show("Salvataggio effettuato correttamente")
					modelPosFin.setProperty("/PosFin/", oData)
					modelPosFin.setProperty("/posFinUpdate", [])
					modelPosFin.setProperty("/payloadModifica", {})
					//this._onObjectMatched()
					// var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
					// oRouter.navTo("DetailPosFin", {
					// 	Fikrs: modelPosFin.getProperty("/infoSottoStrumento/Fikrs"),
					// 	CodiceStrumento: modelPosFin.getProperty("/infoSottoStrumento/CodiceStrumento"),
					// 	CodiceStrumentoOri: modelPosFin.getProperty("/infoSottoStrumento/CodiceStrumentoOri"),
					// 	CodiceSottostrumento: modelPosFin.getProperty("/infoSottoStrumento/CodiceSottostrumento"),
					// 	Datbis: modelPosFin.getProperty("/infoSottoStrumento/Datbis").toISOString(),
					// 	Anno: modelPosFin.getProperty("/PosFin/Anno"),
					// 	Fase: modelPosFin.getProperty("/PosFin/Fase"),
					// 	Reale: modelPosFin.getProperty("/PosFin/Reale"),
					// 	Fipex: "S090105501182202020202"
					// });	
				},
				error: (res) => {
					this.getView().setBusy(false)
					 MessageBox.error("Errore")
					// var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
					// oRouter.navTo("DetailPosFin", {
					// 	Fikrs: modelPosFin.getProperty("/infoSottoStrumento/Fikrs"),
					// 	CodiceStrumento: modelPosFin.getProperty("/infoSottoStrumento/CodiceStrumento"),
					// 	CodiceStrumentoOri: modelPosFin.getProperty("/infoSottoStrumento/CodiceStrumentoOri"),
					// 	CodiceSottostrumento: modelPosFin.getProperty("/infoSottoStrumento/CodiceSottostrumento"),
					// 	Datbis: modelPosFin.getProperty("/infoSottoStrumento/Datbis").toISOString(),
					// 	Anno: modelPosFin.getProperty("/PosFin/Anno"),
					// 	Fase: modelPosFin.getProperty("/PosFin/Fase"),
					// 	Reale: modelPosFin.getProperty("/PosFin/Reale"),
					// 	Fipex: "S090105501182202020202"
					// });	
				}
				})
		},
		__checkAttributiPg: function (oDetailAnagrafica, oPosFin) {
			const modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let aFilters = [
					new Filter("Fikrs", FilterOperator.EQ, "S001"),
					new Filter("Fase", FilterOperator.EQ, "NV"),
					new Filter("Anno", FilterOperator.EQ, oPosFin.Anno),
					new Filter("Capitolo", FilterOperator.EQ, oPosFin.Capitolo),
					new Filter("Prctr", FilterOperator.EQ, oPosFin.Prctr),
					new Filter("Reale", FilterOperator.EQ, oPosFin.Reale),
					new Filter("Pg", FilterOperator.EQ, oPosFin.Pg),
					new Filter("Eos", FilterOperator.EQ, oPosFin.Eos),
					new Filter("Fipex", FilterOperator.EQ, oPosFin.Fipex.replaceAll(".", "")),
					new Filter("Datbis", FilterOperator.EQ, new Date(oPosFin.Datbis)),
					new Filter("AreaDestinataria", FilterOperator.EQ, oDetailAnagrafica.AreaDestinataria) ,
					new Filter("ObiettiviMinisteri", FilterOperator.EQ, oDetailAnagrafica.ObiettiviMinisteri) ,
					new Filter("RuoliSpesaFissa", FilterOperator.EQ, oDetailAnagrafica.RuoliSpesaFissa) ,
					new Filter("StatusPg", FilterOperator.EQ, oDetailAnagrafica.StatusPg === true ? "X" : "") ,
					new Filter("TipoSpesaPg", FilterOperator.EQ, oDetailAnagrafica.TipoSpesaPg) ,
					]
			return new Promise((resolve, reject) => {
				modelHana.read("/PosizioneFinanziariaSet", {
					filters: aFilters,
					success: (oData, res) => {
						resolve(oData.results.length > 0 ? false : true)
					}
				})
			})
		},
		__checkAttributiCapitolo: function (oDetailAnagrafica, oPosFin) {
			const modelPosFin = this.getView().getModel("modelPosFin")
			const modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let aFilters = [
					new Filter("Fikrs", FilterOperator.EQ, "S001"),
					new Filter("Fase", FilterOperator.EQ, "NV"),
					new Filter("Anno", FilterOperator.EQ, oPosFin.Anno),
					new Filter("Capitolo", FilterOperator.EQ, oPosFin.Capitolo),
					new Filter("Prctr", FilterOperator.EQ, oPosFin.Prctr),
					new Filter("Reale", FilterOperator.EQ, oPosFin.Reale),
					new Filter("Pg", FilterOperator.EQ, oPosFin.Pg),
					new Filter("Eos", FilterOperator.EQ, oPosFin.Eos),
					new Filter("Fipex", FilterOperator.EQ, oPosFin.Fipex.replaceAll(".", "")),
					new Filter("Datbis", FilterOperator.EQ, new Date(oPosFin.Datbis)),
					new Filter("Capitolone", FilterOperator.EQ, oDetailAnagrafica.Capitolone) ,
					new Filter("CodiceTipospCapSpe", FilterOperator.EQ, oDetailAnagrafica.tipoSpesaCapitolo) ,
					new Filter("CuIrapNoncu", FilterOperator.EQ, oDetailAnagrafica.CuIrapNoncu) ,
					new Filter("Mac", FilterOperator.EQ, oDetailAnagrafica.MAC) ,
					new Filter("NaturaSpesa", FilterOperator.EQ, oDetailAnagrafica.CodiceNaturaSpesa) ,
					new Filter("Noipa", FilterOperator.EQ, oDetailAnagrafica.Noipa) ,
					new Filter("StatusCapitolo", FilterOperator.EQ, oDetailAnagrafica.StatusCapitolo === true ? "1" : "0") ,
					new Filter("TipoFondo", FilterOperator.EQ, oDetailAnagrafica.tipoFondo) ,
					new Filter("FlagMemcor01", FilterOperator.EQ, oDetailAnagrafica.Memoria) ,
					]
			return new Promise((resolve, reject) => {
				modelHana.read("/PosizioneFinanziariaSet", {
					filters: aFilters,
					success: (oData, res) => {
						resolve(oData.results.length > 0 ? false : true)
					}
				})
			})
		},
		__getElenchiOriginali: function (oPosFin) {
			const modelPosFin = this.getView().getModel("modelPosFin")
			const modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			return new Promise( (resolve, reject) => {
				modelHana.read("/CapitoloElencoSet", {
					filters: [new Filter("Fikrs", FilterOperator.EQ, "S001"),
					new Filter("Fase", FilterOperator.EQ, "NV"),
					new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
					new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
					new Filter("Eos", FilterOperator.EQ, oPosFin.Eos),
					new Filter("Capitolo", FilterOperator.EQ, oPosFin.Capitolo),
					new Filter("Prctr", FilterOperator.EQ, oPosFin.Prctr),
					new Filter({
						filters: [new Filter("PrctrElenco", FilterOperator.EQ, oPosFin.Prctr),
	 							  new Filter("PrctrElenco", FilterOperator.EQ, "A020")
								],
						and: false,
					  }),
					new Filter({
						filters: [
									new Filter("Pg", FilterOperator.EQ, "00"),
									new Filter("Pg", FilterOperator.EQ, oPosFin.Pg)
								],
						and: false,
					})
				],
				success:  async (oData) =>  {
					resolve(oData.results)
				}
				})
			})
		},
		__checkPosFin: function (codice, modelHana, modelPosFin) {
			return new Promise((resolve, reject) => {
				modelHana.read("/ControlliPosFinSet",{
					filters: [
								new Filter("Fikrs", FilterOperator.EQ, "S001"),
								new Filter("Fase", FilterOperator.EQ, "NV"),
								new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
								new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
								new Filter("Fipex", FilterOperator.EQ, modelPosFin.getProperty("/PosFin/Fipex")),
								new Filter("VersionePosfin", FilterOperator.EQ, modelPosFin.getProperty("/PosFin/Versione")),
								new Filter("DatbisPosfin", FilterOperator.GE, new Date()),
								new Filter("CodiceStrumento", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/CodiceStrumento")),
								new Filter("CodiceStrumentoOri", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/CodiceStrumentoOri")),
								new Filter("CodiceSottostrumento", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/CodiceSottostrumento")),
								new Filter("DatbisSstr", FilterOperator.GE, new Date()),
								new Filter("IdControllo", FilterOperator.EQ, codice),
							],
					success: (oData, res) => {
						//debugger
						resolve(oData)
					}
				})
			})
		},
		__setSStrLog: function ( oDetailAnagrafica, aElenchiOriginali, DenCapitolo,DenPg, aCofogOriginali) {
			let aTableSStrLog = []
			let checkCapitolo = false;
			let checkPg = false
			const modelPosFin = this.getView().getModel("modelPosFin")
			let oPosFin = modelPosFin.getProperty("/PosFin")
			//Check Campi modificati
			if(oPosFin.AreaDestinataria !== oDetailAnagrafica.AreaDestinataria) {
				aTableSStrLog.push(this.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
														oPosFin.Datbis, "ZKPOSFIN", "AreaDestinataria", "U", oDetailAnagrafica.AreaDestinataria, oPosFin.AreaDestinataria]))
				checkPg = true
			}
			if(oPosFin.Capitolone !== oDetailAnagrafica.Capitolone) {
				aTableSStrLog.push(this.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
													oPosFin.Datbis, "ZKPOSFIN", "Capitolone", "U", oDetailAnagrafica.Capitolone === true ? 'X' : '', oPosFin.Capitolone === true ? 'X' : '']))
				checkCapitolo = true
			}
			if(oPosFin.CodiceTipospCapSpe !== oDetailAnagrafica.tipoSpesaCapitolo) {
				aTableSStrLog.push(this.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
													oPosFin.Datbis, "ZKPOSFIN", "CodiceTipospCapSpe", "U", oDetailAnagrafica.tipoSpesaCapitolo, oPosFin.CodiceTipospCapSpe]))
				checkCapitolo = true
			}
			if(oPosFin.CuIrapNoncu !== oDetailAnagrafica.CuIrapNoncu) {
				aTableSStrLog.push(this.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
													oPosFin.Datbis, "ZKPOSFIN", "CuIrapNoncu", "U", oDetailAnagrafica.CuIrapNoncu, oPosFin.CuIrapNoncu]))
				checkCapitolo = true
			}
			if(oPosFin.Mac !== oDetailAnagrafica.MAC) {
				aTableSStrLog.push(this.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
													oPosFin.Datbis, "ZKPOSFIN", "Mac", "U", oDetailAnagrafica.MAC, oPosFin.Mac]))
				checkCapitolo = true
			}
			if(oPosFin.NaturaSpesa !== oDetailAnagrafica.CodiceNaturaSpesa) {
				aTableSStrLog.push(this.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
													oPosFin.Datbis, "ZKPOSFIN", "NaturaSpesa", "U", oDetailAnagrafica.CodiceNaturaSpesa, oPosFin.NaturaSpesa]))
				checkCapitolo = true
			}
			if(oPosFin.Noipa !== oDetailAnagrafica.Noipa) {
				aTableSStrLog.push(this.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
													oPosFin.Datbis, "ZKPOSFIN", "Noipa", "U", oDetailAnagrafica.Noipa, oPosFin.Noipa]))
				checkCapitolo = true
			}
			if(oPosFin.ObiettiviMinisteri !== oDetailAnagrafica.ObiettiviMinisteri) {
				aTableSStrLog.push(this.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
													oPosFin.Datbis, "ZKPOSFIN", "ObiettiviMinisteri", "U", (oDetailAnagrafica.ObiettiviMinisteri === true ? "X" : ""), oPosFin.ObiettiviMinisteri === true ? "X" : ""]))
				checkPg = true
			}
			if(oPosFin.RuoliSpesaFissa !== oDetailAnagrafica.RuoliSpesaFissa ) {
				aTableSStrLog.push(this.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
													oPosFin.Datbis, "ZKPOSFIN", "RuoliSpesaFissa", "U", (oDetailAnagrafica.RuoliSpesaFissa === false ? "" : "X"), (oPosFin.RuoliSpesaFissa === false ? "" : "X")]))
				checkPg = true
			}
			if((oPosFin.StatusCapitolo === "3" ? false : true) !== oDetailAnagrafica.StatusCapitolo) {
				aTableSStrLog.push(this.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
													oPosFin.Datbis, "ZKPOSFIN", "StatusCapitolo", "U", oDetailAnagrafica.StatusCapitolo === false ? "3" : (oPosFin.StatusCapitolo === "3" && oDetailAnagrafica.StatusCapitolo === true ? (oDetailAnagrafica.VersioneCapitolo === "D" ? "1" : "0") : oPosFin.StatusCapitolo), oPosFin.StatusCapitolo]))
				checkCapitolo = true
			}
			if((oPosFin.StatusPg === "3" ? false : true) !== oDetailAnagrafica.StatusPg ) {
				aTableSStrLog.push(this.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
													oPosFin.Datbis, "ZKPOSFIN", "StatusPg", "U", oDetailAnagrafica.StatusPg === false ? "3" : ((oPosFin.StatusPg === "3" && oDetailAnagrafica.StatusPg === true) ? (oDetailAnagrafica.VersionePg === "D" ? "1" : "0") : oPosFin.StatusPg), oPosFin.StatusPg]))
				checkPg = true
			}
			if(oPosFin.TipoFondo !== oDetailAnagrafica.tipoFondo) {
				aTableSStrLog.push(this.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
													oPosFin.Datbis, "ZKPOSFIN", "TipoFondo", "U", oDetailAnagrafica.tipoFondo, oPosFin.TipoFondo]))
				checkCapitolo = true
			}
			if(oPosFin.TipoSpesaPg !== oDetailAnagrafica.TipoSpesaPg) {
				aTableSStrLog.push(this.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
													oPosFin.Datbis, "ZKPOSFIN", "TipoSpesaPg", "U", oDetailAnagrafica.TipoSpesaPg, oPosFin.TipoSpesaPg]))
				checkPg = true
			}
			// if(oPosFin.TipoFondo !== oDetailAnagrafica.tipoFondo) {
			// 	aTableSStrLog.push(this.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
			// 										oPosFin.Datbis, "ZKPOSFIN", "TipoFondo", "U", oDetailAnagrafica.tipoFondo, oPosFin.TipoFondo]))
			// 	checkCapitolo = true
			// }
			if(oPosFin.FlagMemcor01 !== oDetailAnagrafica.Memoria) {
				aTableSStrLog.push(this.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
													oPosFin.Datbis, "ZKPOSFIN", "FlagMemcor01", "U", (oDetailAnagrafica.Memoria === true ? "X" : ""), (oPosFin.FlagMemcor01 === true ? "X" : "")]))
				checkCapitolo = true
			}
			//Denominazione capitolo
			if(!oDetailAnagrafica.CODICE_STANDARD_CAPITOLO){
				if(oDetailAnagrafica.CD_CAPITOLO_DEN_EST !==  DenCapitolo.DescEstesaCapitolo ) {
					aTableSStrLog.push(this.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
						 	oPosFin.Datbis, "ZKTIP_CAPITOLO", "DescEstesaCapitolo", "U", oDetailAnagrafica.CD_CAPITOLO_DEN_EST, DenCapitolo.DescEstesaCapitolo]))
					checkCapitolo = true
				}
				if(oDetailAnagrafica.CD_CAPITOLO_DEN_BREVE !== DenCapitolo.DescBreveCapitolo) {
					aTableSStrLog.push(this.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
						oPosFin.Datbis, "ZKTIP_CAPITOLO", "DescBreveCapitolo", "U", oDetailAnagrafica.CD_CAPITOLO_DEN_BREVE, DenCapitolo.DescBreveCapitolo]))
			   		checkCapitolo = true
				}
			} else {
				if(oDetailAnagrafica.CODICE_STANDARD_CAPITOLO !== DenCapitolo.CodiceStdCapitolo){
					aTableSStrLog.push(this.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
						oPosFin.Datbis, "ZKTIP_CAPITOLO", "CodiceStdCapitolo", "U", oDetailAnagrafica.CODICE_STANDARD_CAPITOLO, DenCapitolo.CodiceStdCapitolo]))
			   		checkCapitolo = true
				}
			}

			//Denominazione Pg
			if(!oDetailAnagrafica.CODICE_STANDARD_PG){
				if(oDetailAnagrafica.CD_PG_DEN_EST !==  DenPg.DescEstesaPg ) {
					aTableSStrLog.push(this.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
						 	oPosFin.Datbis, "ZKTIP_PG", "DescEstesaPg", "U", oDetailAnagrafica.CD_PG_DEN_EST, DenPg.DescEstesaPg]))
					//checkCapitolo = true non capisco perche
					checkPg = true
				}
				if(oDetailAnagrafica.CD_PG_DEN_BREVE !== DenPg.DescBrevePg) {
					aTableSStrLog.push(this.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
						oPosFin.Datbis, "ZKTIP_PG", "DescBrevePg", "U", oDetailAnagrafica.CD_PG_DEN_BREVE, DenPg.DescBrevePg]))
			   		//checkCapitolo = true
					   checkPg = true
				}
			} else {
				if(oDetailAnagrafica.CODICE_STANDARD_PG !== DenPg.CodiceStdPg){
					aTableSStrLog.push(this.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
						oPosFin.Datbis, "ZKTIP_PG", "CodiceStdPg", "U", oDetailAnagrafica.CODICE_STANDARD_PG, DenPg.CodiceStdPg]))
			   		//checkCapitolo = true
					   checkPg = true
				}
			}

			//check Elenchi modificati
			for(let i = 0 ; i < oDetailAnagrafica.elenchiCapitolo.length ; i++){
				let currentElencoCap = oDetailAnagrafica.elenchiCapitolo[i]
				let oFindElenco = []
				oFindElenco = aElenchiOriginali.filter(el => (el.Fikrs == currentElencoCap.Fikrs &&
					el.Anno == currentElencoCap.Anno &&
					el.Fase == currentElencoCap.Fase &&
					el.Reale == currentElencoCap.Reale &&
					el.Versione == currentElencoCap.Versione &&
					el.Eos == currentElencoCap.Eos &&
					el.Prctr == currentElencoCap.Prctr &&
					el.Capitolo == currentElencoCap.Capitolo &&
					el.Pg == currentElencoCap.Pg &&
					el.PrctrElenco == currentElencoCap.PrctrElenco &&
					el.NumeroElenco == currentElencoCap.NumeroElenco 
					)
					)
				if(oFindElenco.length === 0) {
					checkCapitolo = true
					aTableSStrLog.push(this.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
						oPosFin.Datbis, "", "", "", "", ""]))
				}
			}
			for(let i = 0 ; i < aElenchiOriginali.length ; i++){
				let currentElencoCap = aElenchiOriginali[i]
				let oFindElenco = []
				 oFindElenco = oDetailAnagrafica.elenchiCapitolo.filter(el => (el.Fikrs == currentElencoCap.Fikrs &&
					el.Anno == currentElencoCap.Anno &&
					el.Fase == currentElencoCap.Fase &&
					el.Reale == currentElencoCap.Reale &&
					el.Versione == currentElencoCap.Versione &&
					el.Eos == currentElencoCap.Eos &&
					el.Prctr == currentElencoCap.Prctr &&
					el.Capitolo == currentElencoCap.Capitolo &&
					el.Pg == currentElencoCap.Pg &&
					el.PrctrElenco == currentElencoCap.PrctrElenco &&
					el.NumeroElenco == currentElencoCap.NumeroElenco 
					)
					)
				if(oFindElenco.length === 0) {
					checkCapitolo = true
					aTableSStrLog.push(this.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
						oPosFin.Datbis, "", "", "", "", ""]))
				}
			}

			//check Modifica Cofog
			if(oDetailAnagrafica.elencoCOFOG.length !== aCofogOriginali.length)
				checkCapitolo = true
			for(let i = 0 ; i < oDetailAnagrafica.elencoCOFOG.length ; i++){
				let currentCofog = oDetailAnagrafica.elencoCOFOG[i]
				let oFindCofog = []
				oFindCofog = aCofogOriginali.filter(el => (
					el.CofogL1 === currentCofog.CofogL1 &&
					el.CofogL2 === currentCofog.CofogL2 &&
					el.CofogL3 === currentCofog.CofogL3 
					)
					)
				if(oFindCofog.length === 0) {
					aTableSStrLog.push(this.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
						oPosFin.Datbis, "", "", "", "", ""]))
					checkCapitolo = true
				}
				else 
					if(this.formatPercent(oFindCofog[0].PercCofog) != this.formatPercent(currentCofog.PercCofog)){
						aTableSStrLog.push(this.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
							oPosFin.Datbis, "", "", "", "", ""]))
						checkCapitolo = true
					}
			}
			//lt check con Beniamino. se elenco modificato = 0 e originali > 0 allora pusho il record per il back-end
			if(checkCapitolo && oDetailAnagrafica.elencoCOFOG.length === 0 && aCofogOriginali.length > 0){
				aTableSStrLog.push(this.__getItemLogSStr([oPosFin.Fikrs, oPosFin.Anno, oPosFin.Fase, oPosFin.Reale, oPosFin.Versione, oPosFin.Fipex,
					oPosFin.Datbis, "", "", "", "", ""]))
			}


			return {tabellaLog:aTableSStrLog, checkCapitolo: checkCapitolo, checkPg: checkPg} 
		},
		__getItemLogSStr: function (oDataLog) {
			const modelPosFin = this.getView().getModel("modelPosFin")
			
			return {
				Fikrs: oDataLog[0],
				Anno: oDataLog[1],
				Fase: oDataLog[2],
				Reale: modelPosFin.getProperty("/infoSottoStrumento/Reale"), //oDataLog[3]
				Versione: oDataLog[4],
				Fipex: oDataLog[5],
				Datbis : oDataLog[6],
				Tabname: oDataLog[7],
				Fname: oDataLog[8],
				FikrsSottostrumento: modelPosFin.getProperty("/infoSottoStrumento/Fikrs"),
				CodiceStrumento: modelPosFin.getProperty("/infoSottoStrumento/CodiceStrumento"),
				CodiceStrumentoOri: modelPosFin.getProperty("/infoSottoStrumento/CodiceStrumentoOri"),
				CodiceSottostrumento: modelPosFin.getProperty("/infoSottoStrumento/CodiceSottostrumento"),
				DatbisSottostrumento: modelPosFin.getProperty("/infoSottoStrumento/Datbis"),
				Chngind: oDataLog[9],
				ValueNew: !oDataLog[10] ? "" : oDataLog[10].slice(0, 254),
				ValueOld: !oDataLog[11] ? "" : oDataLog[11].slice(0, 254),
				Semobj: "semobj",
				Operazione: "OP1",
				Suboperazione: "OP2"
			}	
		},
		__createPayloadUpdate: function (oPosFin, oDetailAnagrafica, bCheckCapitoloPG, objLogcheck,aRelatedPosFin, aElenchiOriginali) {
			//check modifica Capitolo
		

			oPosFin.AreaDestinataria = oDetailAnagrafica.AreaDestinataria 
			oPosFin.Capitolone =  oDetailAnagrafica.Capitolone
			oPosFin.FlagMemcor01 = oDetailAnagrafica.Memoria
			oPosFin.CodiceTipospCapSpe = oDetailAnagrafica.tipoSpesaCapitolo
			oPosFin.CuIrapNoncu = oDetailAnagrafica.CuIrapNoncu
			oPosFin.Mac = oDetailAnagrafica.MAC
			oPosFin.NaturaSpesa =  oDetailAnagrafica.CodiceNaturaSpesa
			oPosFin.Noipa = oDetailAnagrafica.Noipa
			oPosFin.ObiettiviMinisteri = oDetailAnagrafica.ObiettiviMinisteri
			oPosFin.RuoliSpesaFissa = oDetailAnagrafica.RuoliSpesaFissa
			oPosFin.StatusCapitolo = oDetailAnagrafica.StatusCapitolo === false ? "3" : (oPosFin.StatusCapitolo === "3" && oDetailAnagrafica.StatusCapitolo === true ? (oDetailAnagrafica.VersioneCapitolo === "D" ? "1" : "0") : oPosFin.StatusCapitolo)
			oPosFin.StatusPg = oDetailAnagrafica.StatusPg === false ? "3" : ((oPosFin.StatusPg === "3" && oDetailAnagrafica.StatusPg === true) ? (oDetailAnagrafica.VersionePg === "D" ? "1" : "0") : oPosFin.StatusPg)
			oPosFin.TipoFondo = oDetailAnagrafica.tipoFondo
			oPosFin.TipoSpesaPg = oDetailAnagrafica.TipoSpesaPg
			oPosFin.Datbis = new Date(oPosFin.Datbis)
			oPosFin.Datab = oPosFin.Datab === null ? null :  new Date(oPosFin.Datab)
			oPosFin.Ersda = oPosFin.Ersda === null ? null :  new Date(oPosFin.Ersda)
			oPosFin.DataLoekz = oPosFin.DataLoekz === null ? null : new Date(oPosFin.DataLoekz)
			oPosFin.Laeda = oPosFin.Laeda === null ? null : new Date(oPosFin.Laeda)
			
			//Tabella log sottostrumenti
			// oPosFin.UpdateSstrLog = this.__setSStrLog( oDetailAnagrafica, aElenchiOriginali)
			//Elenchi
			oPosFin.UpdateCapitoloElenco = []
			let capitoliElenchi = JSON.parse(JSON.stringify(oDetailAnagrafica.elenchiCapitolo))
			for(let i = 0 ; i < capitoliElenchi.length ; i ++) {
				let currentCapElenco = capitoliElenchi[i]
				delete currentCapElenco.__metadata
				delete currentCapElenco.Desc
				currentCapElenco.Fipex = oPosFin.Fipex
				currentCapElenco.Fikrs = oPosFin.Fikrs
				currentCapElenco.Anno = oPosFin.Anno
				currentCapElenco.Fase = oPosFin.Fase
				currentCapElenco.Reale = oPosFin.Reale
				currentCapElenco.Eos = oPosFin.Eos
				currentCapElenco.Prctr = currentCapElenco.Prctr ? currentCapElenco.Prctr : oPosFin.Prctr
				currentCapElenco.Capitolo = oPosFin.Capitolo
				currentCapElenco.Pg = currentCapElenco.Pg ? currentCapElenco.Pg : oPosFin.Pg
				currentCapElenco.PrctrElenco = currentCapElenco.Prctr
				currentCapElenco.Versione = currentCapElenco.Versione ? currentCapElenco.Versione : "P"
				currentCapElenco.Datbis = currentCapElenco.Datbis ? new Date(currentCapElenco.Datbis) : oPosFin.Datbis
				oPosFin.UpdateCapitoloElenco.push(currentCapElenco)
			}
			//Cofog
			oPosFin.DistribuzioneCofog = []
			let aDistrCofog = JSON.parse(JSON.stringify(oDetailAnagrafica.elencoCOFOG))
			for(let i = 0 ; i < aDistrCofog.length ; i ++){
				let currentCofog = aDistrCofog[i]
				currentCofog.Fikrs = oPosFin.Fikrs
				currentCofog.Anno = oPosFin.Anno
				currentCofog.Reale = oPosFin.Reale
				currentCofog.Versione = oPosFin.Versione
				currentCofog.Fase = oPosFin.Fase
				currentCofog.Fipex = oPosFin.Fipex
				currentCofog.Datbis = currentCofog.Datbis ? new Date(currentCofog.Datbis) : new Date(oPosFin.Datbis)
				currentCofog.PercCofog = Number(currentCofog.PercCofog).toFixed(2)
				delete currentCofog.__metadata
				delete currentCofog.Desc
				
				oPosFin.DistribuzioneCofog.push(currentCofog)
			}

			//Capitolo
			oPosFin.UpdateTipCapitolo = []
			if(bCheckCapitoloPG.resultCapitolo === true || bCheckCapitoloPG.resultPg === true || objLogcheck.checkCapitolo === true || objLogcheck.checkPg === true ) {
				oPosFin.UpdateTipCapitolo.push({
					Fikrs: oPosFin.Fikrs,
					Anno: oPosFin.Anno,
					Fase: oPosFin.Fase,
					Reale: oPosFin.Reale,
					VersioneCapitolo: oDetailAnagrafica.VersioneCapitolo,
					VersionePg: oDetailAnagrafica.VersionePg,
					Eos: oPosFin.Eos,
					Prctr: oPosFin.Prctr,
					Fipex: oPosFin.Fipex,
					Capitolo: oDetailAnagrafica.CAPITOLO,
					Pg: oDetailAnagrafica.pg,
					Datbis: oPosFin.Datbis,
					DescBreveCapitolo: !oDetailAnagrafica.CODICE_STANDARD_CAPITOLO ?  oDetailAnagrafica.CD_CAPITOLO_DEN_BREVE : bCheckCapitoloPG.DenCapitolo.DescBreveCapitolo,
					DescEstesaCapitolo: !oDetailAnagrafica.CODICE_STANDARD_CAPITOLO ? oDetailAnagrafica.CD_CAPITOLO_DEN_EST : bCheckCapitoloPG.DenCapitolo.DescEstesaCapitolo,
					DescBrevePg: !oDetailAnagrafica.CODICE_STANDARD_PG ? oDetailAnagrafica.CD_PG_DEN_BREVE : bCheckCapitoloPG.DenPg.DescBrevePg,
					DescEstesaPg: !oDetailAnagrafica.CODICE_STANDARD_PG ? oDetailAnagrafica.CD_PG_DEN_EST : bCheckCapitoloPG.DenPg.DescEstesaPg,
					CodiceStdCapitolo: oDetailAnagrafica.CODICE_STANDARD_CAPITOLO ? oDetailAnagrafica.CODICE_STANDARD_CAPITOLO : "000",
					CodiceStdPg: oDetailAnagrafica.CODICE_STANDARD_PG ? oDetailAnagrafica.CODICE_STANDARD_PG : "000"
				})
		}

			//Posizioni finanziarie collegate a capitolo
			oPosFin.UpdateRelatedPosfin = []
			// for(let i = 0 ; i < aRelatedPosFin.length ; i++) {
			// 	oPosFin.UpdateRelatedPosfin.push(
			// 		{
			// 			Fikrs: oPosFin.Fikrs,
			// 			Anno: oPosFin.Anno,
			// 			Fase: oPosFin.Fase,
			// 			Reale: oPosFin.Reale,
			// 			Versione: oPosFin.Versione,
			// 			Fipex: oPosFin.Fipex,
			// 			Datbis: new Date(oPosFin.Datbis),
			// 			RelatedFikrs: aRelatedPosFin[i].Fikrs,
			// 			RelatedAnno: aRelatedPosFin[i].Anno,
			// 			RelatedFase: aRelatedPosFin[i].Fase,
			// 			RelatedReale: aRelatedPosFin[i].Reale,
			// 			RelatedVersione: aRelatedPosFin[i].Versione,
			// 			RelatedFipex: aRelatedPosFin[i].Fipex,
			// 			RelatedDatbis: new Date(aRelatedPosFin[i].Datbis),
			// 		}
			// 	)
			// }
			return oPosFin
		},
		__checkDenominazioniCapitoloPGModified: function (oDetailAnag) {
			const modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			var modelPosFin = this.getView().getModel("modelPosFin")
			var oDetailAnag = modelPosFin.getProperty("/detailAnagrafica/")
			let aFiltersCapPg = [new Filter("Fikrs", FilterOperator.EQ, "S001"),
								new Filter("Fase", FilterOperator.EQ, "NV"),
								new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
								new Filter("Capitolo", FilterOperator.EQ, oDetailAnag.CAPITOLO),
								new Filter("Prctr", FilterOperator.EQ, oDetailAnag.AMMINISTAZIONE),
								new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
								new Filter("Pg", FilterOperator.EQ, oDetailAnag.pg),
								new Filter("Eos", FilterOperator.EQ, "S")
								]
			return new Promise((resolve, reject) => {
				modelHana.read("/TipCapitoloSet",{
					filters: aFiltersCapPg,
					success: (oData, res) => {
						let oCheck = {
							resultPg: false,
							resultCapitolo: false,
							DenCapitolo: oData.results.length > 0 ? oData.results[0] : null,
							DenPg : oData.results.length > 0 ? oData.results[0] : null
						}
						if(oData.results.length > 0) {
							//check inserimento den/codice standard capitolo
							if(oDetailAnag.CODICE_STANDARD_CAPITOLO !== null) { // se è stato inserito, controllare che sia diverso/uguale all'originale
								if(oDetailAnag.CODICE_STANDARD_CAPITOLO !== oData.results[0].CodiceStdCapitolo) {
									oCheck.resultCapitolo = true
								}
							} else { // se non è stato inserito, controllare le denominazioni
								if(oDetailAnag.CD_CAPITOLO_DEN_EST !== oData.results[0].DescEstesaCapitolo || oDetailAnag.CD_CAPITOLO_DEN_BREVE !==  oData.results[0].DescBreveCapitolo)
									oCheck.resultCapitolo = true
							}

							//check inserimento den/codice standard pg
							if(oDetailAnag.CODICE_STANDARD_PG !== null) { // se è stato inserito, controllare che sia diverso/uguale all'originale
								if(oDetailAnag.CODICE_STANDARD_PG !== oData.results[0].CodiceStdPg) {
									oCheck.resultPg = true
								}
							} else { // se non è stato inserito, controllare le denominazioni
								if(oDetailAnag.CD_PG_DEN_EST !== oData.results[0].DescEstesaPg || oDetailAnag.CD_PG_DEN_BREVE !==  oData.results[0].DescBrevePg)
									oCheck.resultPg = true
							}
						}
						resolve(oCheck)
					}
				})
			})
		},
		__checkPosFinModified: function (oPosFin, oDetailAnagrafica) {
			const modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			var modelPosFin = this.getView().getModel("modelPosFin")
			let aFilters = [
							new Filter("Fikrs", FilterOperator.EQ, "S001"),
							new Filter("Fase", FilterOperator.EQ, "NV"),
							new Filter("Anno", FilterOperator.EQ, oPosFin.Anno),
							new Filter("Capitolo", FilterOperator.EQ, oPosFin.Capitolo),
							new Filter("Prctr", FilterOperator.EQ, oPosFin.Prctr),
							new Filter("Reale", FilterOperator.EQ, oPosFin.Reale),
							new Filter("Pg", FilterOperator.EQ, oPosFin.Pg),
							new Filter("Eos", FilterOperator.EQ, oPosFin.Eos),
							new Filter("AreaDestinataria", FilterOperator.EQ, oDetailAnagrafica.AreaDestinataria) ,
							new Filter("Capitolone", FilterOperator.EQ, oDetailAnagrafica.Capitolone) ,
							new Filter("CodiceTipospCapSpe", FilterOperator.EQ, oDetailAnagrafica.tipoSpesaCapitolo) ,
							new Filter("CuIrapNoncu", FilterOperator.EQ, oDetailAnagrafica.CuIrapNoncu) ,
							new Filter("Mac", FilterOperator.EQ, oDetailAnagrafica.MAC) ,
							new Filter("NaturaSpesa", FilterOperator.EQ, oDetailAnagrafica.CodiceNaturaSpesa) ,
							new Filter("Noipa", FilterOperator.EQ, oDetailAnagrafica.Noipa) ,
							new Filter("ObiettiviMinisteri", FilterOperator.EQ, oDetailAnagrafica.ObiettiviMinisteri === true ? "X" : "") ,
							new Filter("RuoliSpesaFissa", FilterOperator.EQ, oDetailAnagrafica.RuoliSpesaFissa === false ? "00" : "01") ,
							new Filter("StatusCapitolo", FilterOperator.EQ, oDetailAnagrafica.StatusCapitolo === true ? "1" : "0") ,
							new Filter("StatusPg", FilterOperator.EQ, oDetailAnagrafica.StatusPg === true ? "X" : "") ,
							new Filter("TipoFondo", FilterOperator.EQ, oDetailAnagrafica.tipoFondo) ,
							new Filter("TipoSpesaPg", FilterOperator.EQ, oDetailAnagrafica.TipoSpesaPg) ,
			]
			return new Promise((resolve, reject) => {
				modelHana.read("/PosizioneFinanziariaSet", {
					filters: aFilters,
					success: (oData, res) => {
						resolve(oData.results.length > 0 ? false : true)
					}
				})
			})
		},
		__getRelatedPosFinByCapitolo: function (oPosFin) {
			const modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let aFilters = [
				new Filter("Fikrs", FilterOperator.EQ, "S001"),
				new Filter("Fase", FilterOperator.EQ, "NV"),
				new Filter("Anno", FilterOperator.EQ, oPosFin.Anno),
				new Filter("Capitolo", FilterOperator.EQ, oPosFin.Capitolo),
				new Filter("Reale", FilterOperator.EQ, oPosFin.Reale),
				new Filter("Prctr", FilterOperator.EQ, oPosFin.Prctr),
				new Filter("Fipex", FilterOperator.NE, oPosFin.Fipex),
				new Filter("Eos", FilterOperator.EQ, oPosFin.Eos)
			]
			return new Promise((resolve, reject) => {
				modelHana.read("/PosizioneFinanziariaSet", {
					filters: aFilters,
					success: (oData, res) => {
						resolve(oData.results)
					}
				})
			})
		},
		onSaveCreaPosFin: async function (oEvent) {
			this.getView().setBusy(true)
			const modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			const modelPosFin = this.getView().getModel("modelPosFin")
			let oDetailAnagrafica = modelPosFin.getProperty("/detailAnagrafica")

			let oDenomCapitolo = await this.__getCapitolo()
			if(oDenomCapitolo){
				if(oDenomCapitolo.results.find(item => item.VERSIONE === 'P'))
					oDenomCapitolo = oDenomCapitolo.results.find(item => item.VERSIONE === 'P')
				else 
					oDenomCapitolo = oDenomCapitolo.results[0]
			}

			let payload = this.__createPayloadCrea(oDetailAnagrafica, oDenomCapitolo)
			modelHana.create("/PosizioneFinanziariaSet" ,payload, {
				success: (oData) => {
					this.getView().setBusy(false)
					MessageBox.show("Salvataggio effettuato correttamente")
					modelPosFin.setProperty("/PosFin/", oData)
					modelPosFin.setProperty("/onModify", true)
					modelPosFin.setProperty("/onCreate", false)
					this._onObjectMatched()
				},
				error: (res) => {
					this.getView().setBusy(false)
					MessageBox.error("Errore")
				}
			})
		},
		onSaveCreaPosFin2: function () {
			this.getView().setBusy(true)
			const modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			const modelPosFin = this.getView().getModel("modelPosFin")
			const modelTopologiche = this.getOwnerComponent().getModel("sapHanaS2Tipologiche")
			let oDetailAnagrafica = modelPosFin.getProperty("/detailAnagrafica")
			let oDenomCapitolo = null
			let messageState = ""
			var that = this
			var state = true
			let oPosFin = {}
			this.pipeAsync(
				 this.__checkExistNewPosFin,
				 this.__checkFaseAmminAperta,
				 this.__checkCOFOGSomma,
				 this.__getCapitolo2,
				 this.__createPayloadCrea2,
				 this.__saveOrReject,
				this.__setVideoMessageRefresh
		)({modelHana, modelPosFin,modelTopologiche,oDetailAnagrafica, oDenomCapitolo ,that, state, oPosFin,messageState})
		},
		__checkCOFOGSomma: function (oParam) {
			//debugger
			let aCofog = oParam.oDetailAnagrafica.elencoCOFOG
			const sumCofog = aCofog.reduce((partialSum, a) => partialSum + parseFloat(a.PercCofog, 2), 0)
			if(sumCofog !== parseFloat(100, 2)){
				return {
					...oParam,
					state: false,
					messageState: aCofog.length > 0 ? ( aCofog.length === 1 ? "La COFOG inserita deve avere percentuale uguale a 100" : "La somma delle percentuali COFOG è diversa da 100") : "Inserire almeno una COFOG"
				}
			} else {
				return {
					...oParam
				}	
			}
		},
		__checkExistNewPosFin: function (oParam) {
			const oDetailAnagrafica = oParam.oDetailAnagrafica
			const oSottostrumento = oParam.modelPosFin.getProperty("/infoSottoStrumento")
			const sFipexNewPosFin = "S" + oDetailAnagrafica.AMMINISTAZIONE.substring(1, oDetailAnagrafica.AMMINISTAZIONE.length ) + oDetailAnagrafica.CAPITOLO +
			oDetailAnagrafica.pg + oDetailAnagrafica.MISSIONE + oDetailAnagrafica.PROGRAMMA + oDetailAnagrafica.AZIONE + oDetailAnagrafica.CATEGORIA + 
			oDetailAnagrafica.CE2 + oDetailAnagrafica.CE3

			let aFilters = [
				new Filter("Fikrs", FilterOperator.EQ, oSottostrumento.Fikrs),
				new Filter("Anno", FilterOperator.EQ, oSottostrumento.AnnoSstr),
				new Filter("Fase", FilterOperator.EQ, oSottostrumento.Fase),
				new Filter("Reale", FilterOperator.EQ, oSottostrumento.Reale),
				new Filter({
					filters: [
						new Filter({
							filters: [
								new Filter("Capitolo", FilterOperator.EQ, oDetailAnagrafica.CAPITOLO),
								new Filter("Pg", FilterOperator.EQ, oDetailAnagrafica.pg),
								new Filter("Prctr", FilterOperator.EQ, oDetailAnagrafica.AMMINISTAZIONE),
							],
							and: true
						}),
					    new Filter({
							filters: [new Filter("Fipex", FilterOperator.EQ, sFipexNewPosFin)],
							and: true
						})
					],
					and: false
				})
			]
			return new Promise((resolve, reject) => {
				oParam.that._getEntitySet("/PosizioneFinanziariaSet", aFilters, oParam.modelHana)
					.then(res => {
						if(!res['/PosizioneFinanziariaSet']) { // la Posizione Finanziaria in creazione non esiste - esito ok
							resolve({
								...oParam
							})
						} else //la Posizione Finanziaria in creazione  esiste - esito ko
							resolve({
								...oParam,
								state: false,
								messageState: "Posizione Finanziaria già esistente"
							})
					})
			})
		},
		__checkFaseAmminAperta: function (oParam) {
			// let homeModel = this.getView().getModel("modelPosFin")
			// const oSottostrumento = homeModel.getProperty("/infoSottoStrumento")
			const modelPosFin = oParam.modelPosFin
			const oSottostrumento = modelPosFin.getProperty("/infoSottoStrumento")
			const modelHana = oParam.modelHana

			let aFilters = [
				new Filter("Anno", FilterOperator.EQ, oSottostrumento.AnnoSstr),
				new Filter("Fase", FilterOperator.EQ, oSottostrumento.Fase),
				new Filter("TipoSstr", FilterOperator.EQ, oSottostrumento.TipoSstr),
				new Filter("FlagStatus", FilterOperator.EQ, '1'),
				new Filter("Prctr", FilterOperator.EQ, oParam.oDetailAnagrafica.AMMINISTAZIONE),
				new Filter("StatoAmmin", FilterOperator.EQ, '1'),
			]
			return new Promise((resolve, reject) => {
				oParam.that._getEntitySet("/FasiAmminSStrSet", aFilters, modelHana)
					.then(res => {
						if(res['/FasiAmminSStrSet']) {
							resolve({
								...oParam
							})
						} else 
							resolve({
								...oParam,
								state: false,
								messageState: "Non si possono lavorare Posizioni Finanziarie di Amministrazioni con fase chiusa"
							})
					})
			})

		},
		__getCapitolo2: function (oParam) {
			const modelPosFin = oParam.modelPosFin
			const modelTopologiche = oParam.modelTopologiche


			let aFiltersCap = [new Filter("FIKRS", FilterOperator.EQ, "S001"),
								new Filter("FASE", FilterOperator.EQ, "NV"),
								new Filter("ANNO", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
								new Filter("CODICE_CAPITOLO", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/CAPITOLO")),
								new Filter("PRCTR", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE")),
								new Filter("REALE", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
								new Filter("EOS", FilterOperator.EQ, "S")
								]
				return new Promise((resolve, reject) => {
					if(!oParam.state)
						resolve( {
							...oParam
						})
					else
						modelTopologiche.read("/ZES_CAPITOLO_SET",{
							filters: aFiltersCap,
							urlParameters: {
								$top: 2
							},
							success: (oData) => {
								let oCapitolo = null
								if (oData.results.length > 0) {
									if(oData.results.find(item => item.VERSIONE === 'P'))
										oCapitolo = oData.results.find(item => item.VERSIONE === 'P')
									else 
										oCapitolo = oData.results[0]
								}
								resolve({
									...oParam,
									oDenomCapitolo: oCapitolo
								})
							},
							error:  (err) => {
								resolve({
									...oParam
								})
							}
						})
				})
		},
		__createPayloadCrea2: function ( oParam) {
			
			if(!oParam.state)
				return {
					...oParam
				}
			const modelPosFin = oParam.modelPosFin
			let oDenomCapitolo = oParam.oDenomCapitolo
			let oDetailAnagrafica = oParam.oDetailAnagrafica

			let oPosFin = {}
			oPosFin.Fikrs= modelPosFin.getProperty("/infoSottoStrumento/Fikrs")
			oPosFin.Eos = "S"
			oPosFin.Anno = modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")
			oPosFin.Fase = modelPosFin.getProperty("/infoSottoStrumento/Fase")
			oPosFin.Reale = modelPosFin.getProperty("/infoSottoStrumento/Reale")
			oPosFin.Versione = "P"
			oPosFin.FlagMemcor01 = oDetailAnagrafica.Memoria ? oDetailAnagrafica.Memoria : false
			oPosFin.Fipex = "S" + oDetailAnagrafica.AMMINISTAZIONE.substring(1, oDetailAnagrafica.AMMINISTAZIONE.length ) + oDetailAnagrafica.CAPITOLO +
							oDetailAnagrafica.pg + oDetailAnagrafica.MISSIONE + oDetailAnagrafica.PROGRAMMA + oDetailAnagrafica.AZIONE + oDetailAnagrafica.CATEGORIA + 
							oDetailAnagrafica.CE2 + oDetailAnagrafica.CE3
			oPosFin.Prctr = oDetailAnagrafica.AMMINISTAZIONE
			oPosFin.Capitolo = oDetailAnagrafica.CAPITOLO
			oPosFin.Pg = oDetailAnagrafica.pg
			oPosFin.Missione = oDetailAnagrafica.MISSIONE
			oPosFin.Programma = oDetailAnagrafica.PROGRAMMA
			oPosFin.Azione = oDetailAnagrafica.AZIONE
			oPosFin.UdvL1Spe = oDetailAnagrafica.UdvL1
			oPosFin.UdvL2Spe = oDetailAnagrafica.UdvL2
			oPosFin.Titolo = oDetailAnagrafica.TITOLO
			oPosFin.Categoria = oDetailAnagrafica.CATEGORIA
			oPosFin.Cdr = oDetailAnagrafica.CDR
			oPosFin.Ragioneria = oDetailAnagrafica.RAG
			oPosFin.Ce2 = oDetailAnagrafica.CE2
			oPosFin.Ce3 = oDetailAnagrafica.CE3
			oPosFin.Ammin = oDetailAnagrafica.AMMINISTAZIONE.substring(1, oDetailAnagrafica.AMMINISTAZIONE.length )
			oPosFin.Natura = ""
			oPosFin.Tipologia = ""
			oPosFin.Provento = ""
			oPosFin.CodiceAzioneOrdinata = ""
			//oPosFin.Tcrc = "00"
			//oPosFin.Tcrf  = "00"
			oPosFin.FlagInibitoSpese =""
			oPosFin.FipexIrapSpe =""
			//oPosFin.PercAggrCapSpe ="000"
			oPosFin.PercAggredPSpe ="0.00"
			oPosFin.CodiFofpSpe =""
			oPosFin.GestioneUnificata ="0"
			oPosFin.CodificaRepPf =""
			oPosFin.DescBreve =""
			oPosFin.DescEstesa =""
			oPosFin.FlagVisCoan = ""
			oPosFin.FlagVisSpe  = ""
			oPosFin.FlagVisEnt = ""
			oPosFin.NumeroCodiceDettaglioCapo = "000"
			oPosFin.FlagGestCompResEnt = ""
			oPosFin.FlagCapArtImpOIntEnt = false
			oPosFin.FlagImpDelegaF24Ent = false
			oPosFin.FlagRuoliAgenteRiscEnt= false
			oPosFin.FlagVersDirettiBilancioEnt= false
			oPosFin.FlagVersDirettiF23Ent= false
			oPosFin.FlagContSpecEnt= false
			oPosFin.FlagContCorrPostEnt= false
			oPosFin.FlagAgcontEnt= false
			oPosFin.FlagUeEnt= false
			oPosFin.FlagCapArtDevEnt= false
			oPosFin.CapitoloInteressiEnt= ""
			oPosFin.CodiceArticoloIntEnt= ""
			oPosFin.UdvL1Ent = ""
			oPosFin.UdvL2Ent = ""
			oPosFin.UdvL3Ent = ""
			oPosFin.Attivo = "X"


			oPosFin.AreaDestinataria = oDetailAnagrafica.AreaDestinataria ? oDetailAnagrafica.AreaDestinataria : ""
			oPosFin.Capitolone =  oDetailAnagrafica.Capitolone
			oPosFin.CodiceTipospCapSpe = oDetailAnagrafica.tipoSpesaCapitolo ? oDetailAnagrafica.tipoSpesaCapitolo : '' 
			oPosFin.CuIrapNoncu = oDetailAnagrafica.CuIrapNoncu
			oPosFin.Mac = oDetailAnagrafica.MAC
			oPosFin.NaturaSpesa =  oDetailAnagrafica.CodiceNaturaSpesa === null ? '' : oDetailAnagrafica.CodiceNaturaSpesa
			oPosFin.Noipa = oDetailAnagrafica.Noipa
			oPosFin.ObiettiviMinisteri = oDetailAnagrafica.ObiettiviMinisteri ? oDetailAnagrafica.ObiettiviMinisteri : false
			oPosFin.RuoliSpesaFissa = oDetailAnagrafica.RuoliSpesaFissa  ? oDetailAnagrafica.RuoliSpesaFissa : false
			oPosFin.StatusCapitolo = "1"
			oPosFin.StatusPg = "0"
			oPosFin.TipoFondo = oDetailAnagrafica.tipoFondo === null ? '' : oDetailAnagrafica.tipoFondo
			oPosFin.TipoSpesaPg = oDetailAnagrafica.TipoSpesaPg ? oDetailAnagrafica.TipoSpesaPg : ""
			oPosFin.Datbis = modelPosFin.getProperty("/infoSottoStrumento/Datbis")
			oPosFin.Datab = new Date()
			oPosFin.Ersda = new Date()
			oPosFin.DataLoekz = null
			oPosFin.Laeda = new Date()
			oPosFin.Loekz = ""
			oPosFin.CreatedAtTime = {
				__edmType: "Edm.Time",
				ms: 0
			}
			oPosFin.Ernam = ""
			oPosFin.Aenam = ""
			
			//Tabella log sottostrumenti
			// oPosFin.UpdateSstrLog = this.__setSStrLog( oDetailAnagrafica, aElenchiOriginali)
			//Elenchi
			oPosFin.UpdateCapitoloElenco = []
			
			for(let i = 0 ; i < oDetailAnagrafica.elenchiCapitolo.length ; i ++) {
				let currentCapElenco = oDetailAnagrafica.elenchiCapitolo[i]
				currentCapElenco.Fikrs = modelPosFin.getProperty("/infoSottoStrumento/Fikrs")
				currentCapElenco.Anno = modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")
				currentCapElenco.Fase = modelPosFin.getProperty("/infoSottoStrumento/Fase")
				currentCapElenco.Reale =  modelPosFin.getProperty("/infoSottoStrumento/Reale")
				currentCapElenco.Fipex =  oPosFin.Fipex
				currentCapElenco.Versione = "P"
				currentCapElenco.Eos = "S"
				currentCapElenco.Prctr = oPosFin.Prctr
				currentCapElenco.Capitolo = oPosFin.Capitolo
				currentCapElenco.Pg = currentCapElenco.Pg ? currentCapElenco.Pg : oPosFin.Pg
				currentCapElenco.Datbis = modelPosFin.getProperty("/infoSottoStrumento/Datbis")
				delete currentCapElenco.__metadata
				delete currentCapElenco.Desc
				oPosFin.UpdateCapitoloElenco.push(currentCapElenco)
			}
			//Cofog
			oPosFin.DistribuzioneCofog = []
			for(let i = 0 ; i < oDetailAnagrafica.elencoCOFOG.length ; i ++){
				let currentCofog = oDetailAnagrafica.elencoCOFOG[i]
				currentCofog.Fikrs = modelPosFin.getProperty("/infoSottoStrumento/Fikrs")
				currentCofog.Anno = modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")
				currentCofog.Fase = modelPosFin.getProperty("/infoSottoStrumento/Fase")
				currentCofog.Reale =  modelPosFin.getProperty("/infoSottoStrumento/Reale")
				currentCofog.Fipex =  oPosFin.Fipex
				currentCofog.Versione = "P"
				currentCofog.Datbis =  modelPosFin.getProperty("/infoSottoStrumento/Datbis")
				currentCofog.PercCofog = Number(currentCofog.PercCofog).toFixed(2)
				delete currentCofog.__metadata
				delete currentCofog.Desc
				
				oPosFin.DistribuzioneCofog.push(currentCofog)
			}

			//Capitolo
			oPosFin.UpdateTipCapitolo = []
			oPosFin.UpdateTipCapitolo.push({
				Fikrs: modelPosFin.getProperty("/infoSottoStrumento/Fikrs"),
				Anno: modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr"),
				Fase: modelPosFin.getProperty("/infoSottoStrumento/Fase"),
				Reale: modelPosFin.getProperty("/infoSottoStrumento/Reale"),
				VersioneCapitolo: oDetailAnagrafica.VersioneCapitolo ? oDetailAnagrafica.VersioneCapitolo : 'P',
				VersionePg: "P",
				Eos: "S",
				Prctr: oDetailAnagrafica.AMMINISTAZIONE,
				Fipex: "S" + oDetailAnagrafica.AMMINISTAZIONE.substring(1, oDetailAnagrafica.AMMINISTAZIONE.length ) + oDetailAnagrafica.CAPITOLO +
						oDetailAnagrafica.pg + oDetailAnagrafica.MISSIONE + oDetailAnagrafica.PROGRAMMA + oDetailAnagrafica.AZIONE + oDetailAnagrafica.CATEGORIA + 
						oDetailAnagrafica.CE2 + oDetailAnagrafica.CE3,
				Capitolo: oDetailAnagrafica.CAPITOLO,
				Pg: oDetailAnagrafica.pg,
				Datbis: modelPosFin.getProperty("/infoSottoStrumento/Datbis"),
				DescBreveCapitolo: !oDetailAnagrafica.CODICE_STANDARD_CAPITOLO ?  oDetailAnagrafica.CD_CAPITOLO_DEN_BREVE : (oDenomCapitolo ? oDenomCapitolo.DESC_BREVE : ''),
				DescEstesaCapitolo:  !oDetailAnagrafica.CODICE_STANDARD_CAPITOLO ? oDetailAnagrafica.CD_CAPITOLO_DEN_EST : (oDenomCapitolo ? oDenomCapitolo.DESCR_ESTESA : ''),
				DescBrevePg: !oDetailAnagrafica.CODICE_STANDARD_PG ? oDetailAnagrafica.CD_PG_DEN_BREVE : '',
				DescEstesaPg: !oDetailAnagrafica.CODICE_STANDARD_PG ? oDetailAnagrafica.CD_PG_DEN_EST : '',
				CodiceStdCapitolo: oDetailAnagrafica.CODICE_STANDARD_CAPITOLO ? oDetailAnagrafica.CODICE_STANDARD_CAPITOLO : "000",
				CodiceStdPg: oDetailAnagrafica.CODICE_STANDARD_PG ? oDetailAnagrafica.CODICE_STANDARD_PG : "000"
			})
			oPosFin.UpdateRelatedPosfin = []

			oPosFin.UpdateSstrLog = []
			oPosFin.UpdateSstrLog.push(oParam.that.__getItemLogSStr([modelPosFin.getProperty("/infoSottoStrumento/Fikrs"), 
															  modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr"),
															  modelPosFin.getProperty("/infoSottoStrumento/Fase"),
															  modelPosFin.getProperty("/infoSottoStrumento/Reale"),
															  "P", oPosFin.Fipex,
															  modelPosFin.getProperty("/infoSottoStrumento/Datbis"), "ZKPOSFIN", "", "I", "", ""]))
			
			return {
				...oParam,
				oPosFin: oPosFin
			}
		},
		__saveOrReject: function (oParam) {
			const modelHana = oParam.modelHana
			let payload = oParam.oPosFin
			return new Promise((resolve, reject) => {
				if(!oParam.state)
					resolve({...oParam})
				else 
					modelHana.create("/PosizioneFinanziariaSet" ,payload, {
						success: (oData) => {
							resolve({
								...oParam,
								newPosFin: oData,
								state: true,
								messageState: "Salvataggio effettuato correttamente"
							})
						},
						error: (res) => {
							resolve({
								...oParam,
								newPosFin: null,
								state: false,
								messageState: "Errore nella creazione della Posizione Finanziaria"
							})
						}
					})
			})
		},
		__setVideoMessageRefresh: function (oParam) {
				  oParam.that.getView().setBusy(false)
				  if (oParam.state) {
					MessageBox.success(oParam.messageState)
					oParam.modelPosFin.setProperty("/PosFin/", oParam.newPosFin)
					oParam.modelPosFin.setProperty("/onModify", true)
					oParam.modelPosFin.setProperty("/onCreate", false)
					oParam.that._onObjectMatched()
				  } else {
					MessageBox.error(oParam.messageState)
				  }
				  return
				  
		},
		__getDenominazioniCapitolo: function (oDetailAnagrafica) {
			const modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			var modelPosFin = this.getView().getModel("modelPosFin")
			var oDetailAnag = modelPosFin.getProperty("/detailAnagrafica/")
			let aFiltersCapPg = [new Filter("Fikrs", FilterOperator.EQ, "S001"),
								new Filter("Fase", FilterOperator.EQ, "NV"),
								new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
								new Filter("Capitolo", FilterOperator.EQ, oDetailAnag.CAPITOLO),
								new Filter("Prctr", FilterOperator.EQ, oDetailAnag.AMMINISTAZIONE),
								new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
								new Filter("Eos", FilterOperator.EQ, "S")
								]
			return new Promise((resolve, reject) => {
				modelHana.read("/TipCapitoloSet",{
					filters: aFiltersCapPg,
					success: (oData, res) => {
						resolve(oData.results.length > 0 ? oData.results[0] : null)
					}
				})
			})
		},
		__createPayloadCrea: function ( oDetailAnagrafica, oDenomCapitolo) {
			const modelPosFin = this.getView().getModel("modelPosFin")
			let oPosFin = {}
			oPosFin.Fikrs= modelPosFin.getProperty("/infoSottoStrumento/Fikrs")
			oPosFin.Eos = "S"
			oPosFin.Anno = modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")
			oPosFin.Fase = modelPosFin.getProperty("/infoSottoStrumento/Fase")
			oPosFin.Reale = modelPosFin.getProperty("/infoSottoStrumento/Reale")
			oPosFin.Versione = "P"
			oPosFin.FlagMemcor01 = oDetailAnagrafica.Memoria ? oDetailAnagrafica.Memoria : false
			oPosFin.Fipex = "S" + oDetailAnagrafica.AMMINISTAZIONE.substring(1, oDetailAnagrafica.AMMINISTAZIONE.length ) + oDetailAnagrafica.CAPITOLO +
							oDetailAnagrafica.pg + oDetailAnagrafica.MISSIONE + oDetailAnagrafica.PROGRAMMA + oDetailAnagrafica.AZIONE + oDetailAnagrafica.CATEGORIA + 
							oDetailAnagrafica.CE2 + oDetailAnagrafica.CE3
			oPosFin.Prctr = oDetailAnagrafica.AMMINISTAZIONE
			oPosFin.Capitolo = oDetailAnagrafica.CAPITOLO
			oPosFin.Pg = oDetailAnagrafica.pg
			oPosFin.Missione = oDetailAnagrafica.MISSIONE
			oPosFin.Programma = oDetailAnagrafica.PROGRAMMA
			oPosFin.Azione = oDetailAnagrafica.AZIONE
			oPosFin.UdvL1Spe = oDetailAnagrafica.UdvL1
			oPosFin.UdvL2Spe = oDetailAnagrafica.UdvL2
			oPosFin.Titolo = oDetailAnagrafica.TITOLO
			oPosFin.Categoria = oDetailAnagrafica.CATEGORIA
			oPosFin.Cdr = oDetailAnagrafica.CDR
			oPosFin.Ragioneria = oDetailAnagrafica.RAG
			oPosFin.Ce2 = oDetailAnagrafica.CE2
			oPosFin.Ce3 = oDetailAnagrafica.CE3
			oPosFin.Ammin = oDetailAnagrafica.AMMINISTAZIONE.substring(1, oDetailAnagrafica.AMMINISTAZIONE.length )
			oPosFin.Natura = ""
			oPosFin.Tipologia = ""
			oPosFin.Provento = ""
			oPosFin.CodiceAzioneOrdinata = ""
			//oPosFin.Tcrc = "00"
			//oPosFin.Tcrf  = "00"
			oPosFin.FlagInibitoSpese =""
			oPosFin.FipexIrapSpe =""
			//oPosFin.PercAggrCapSpe ="000"
			oPosFin.PercAggredPSpe ="0.00"
			oPosFin.CodiFofpSpe =""
			oPosFin.GestioneUnificata ="0"
			oPosFin.CodificaRepPf =""
			oPosFin.DescBreve =""
			oPosFin.DescEstesa =""
			oPosFin.FlagVisCoan = ""
			oPosFin.FlagVisSpe  = ""
			oPosFin.FlagVisEnt = ""
			oPosFin.NumeroCodiceDettaglioCapo = "000"
			oPosFin.FlagGestCompResEnt = ""
			oPosFin.FlagCapArtImpOIntEnt = false
			oPosFin.FlagImpDelegaF24Ent = false
			oPosFin.FlagRuoliAgenteRiscEnt= false
			oPosFin.FlagVersDirettiBilancioEnt= false
			oPosFin.FlagVersDirettiF23Ent= false
			oPosFin.FlagContSpecEnt= false
			oPosFin.FlagContCorrPostEnt= false
			oPosFin.FlagAgcontEnt= false
			oPosFin.FlagUeEnt= false
			oPosFin.FlagCapArtDevEnt= false
			oPosFin.CapitoloInteressiEnt= ""
			oPosFin.CodiceArticoloIntEnt= ""
			oPosFin.UdvL1Ent = ""
			oPosFin.UdvL2Ent = ""
			oPosFin.UdvL3Ent = ""
			oPosFin.Attivo = "X"


			oPosFin.AreaDestinataria = oDetailAnagrafica.AreaDestinataria ? oDetailAnagrafica.AreaDestinataria : ""
			oPosFin.Capitolone =  oDetailAnagrafica.Capitolone
			oPosFin.CodiceTipospCapSpe = oDetailAnagrafica.tipoSpesaCapitolo ? oDetailAnagrafica.tipoSpesaCapitolo : '' 
			oPosFin.CuIrapNoncu = oDetailAnagrafica.CuIrapNoncu
			oPosFin.Mac = oDetailAnagrafica.MAC
			oPosFin.NaturaSpesa =  oDetailAnagrafica.CodiceNaturaSpesa === null ? '' : oDetailAnagrafica.CodiceNaturaSpesa
			oPosFin.Noipa = oDetailAnagrafica.Noipa
			oPosFin.ObiettiviMinisteri = oDetailAnagrafica.ObiettiviMinisteri ? oDetailAnagrafica.ObiettiviMinisteri : false
			oPosFin.RuoliSpesaFissa = oDetailAnagrafica.RuoliSpesaFissa  ? oDetailAnagrafica.RuoliSpesaFissa : false
			oPosFin.StatusCapitolo = "1"
			oPosFin.StatusPg = "0"
			oPosFin.TipoFondo = oDetailAnagrafica.tipoFondo === null ? '' : oDetailAnagrafica.tipoFondo
			oPosFin.TipoSpesaPg = oDetailAnagrafica.TipoSpesaPg ? oDetailAnagrafica.TipoSpesaPg : ""
			oPosFin.Datbis = modelPosFin.getProperty("/infoSottoStrumento/Datbis")
			oPosFin.Datab = new Date()
			oPosFin.Ersda = new Date()
			oPosFin.DataLoekz = null
			oPosFin.Laeda = new Date()
			oPosFin.Loekz = ""
			oPosFin.CreatedAtTime = {
				__edmType: "Edm.Time",
				ms: 0
			}
			oPosFin.Ernam = ""
			oPosFin.Aenam = ""
			
			//Tabella log sottostrumenti
			// oPosFin.UpdateSstrLog = this.__setSStrLog( oDetailAnagrafica, aElenchiOriginali)
			//Elenchi
			oPosFin.UpdateCapitoloElenco = []
			
			for(let i = 0 ; i < oDetailAnagrafica.elenchiCapitolo.length ; i ++) {
				let currentCapElenco = oDetailAnagrafica.elenchiCapitolo[i]
				currentCapElenco.Fikrs = modelPosFin.getProperty("/infoSottoStrumento/Fikrs")
				currentCapElenco.Anno = modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")
				currentCapElenco.Fase = modelPosFin.getProperty("/infoSottoStrumento/Fase")
				currentCapElenco.Reale =  modelPosFin.getProperty("/infoSottoStrumento/Reale")
				currentCapElenco.Fipex =  oPosFin.Fipex
				currentCapElenco.Versione = "P"
				currentCapElenco.Eos = "S"
				currentCapElenco.Prctr = oPosFin.Prctr
				currentCapElenco.Capitolo = oPosFin.Capitolo
				currentCapElenco.Pg = currentCapElenco.Pg ? currentCapElenco.Pg : oPosFin.Pg
				currentCapElenco.Datbis = modelPosFin.getProperty("/infoSottoStrumento/Datbis")
				delete currentCapElenco.__metadata
				delete currentCapElenco.Desc
				oPosFin.UpdateCapitoloElenco.push(currentCapElenco)
			}
			//Cofog
			oPosFin.DistribuzioneCofog = []
			for(let i = 0 ; i < oDetailAnagrafica.elencoCOFOG.length ; i ++){
				let currentCofog = oDetailAnagrafica.elencoCOFOG[i]
				currentCofog.Fikrs = modelPosFin.getProperty("/infoSottoStrumento/Fikrs")
				currentCofog.Anno = modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")
				currentCofog.Fase = modelPosFin.getProperty("/infoSottoStrumento/Fase")
				currentCofog.Reale =  modelPosFin.getProperty("/infoSottoStrumento/Reale")
				currentCofog.Fipex =  oPosFin.Fipex
				currentCofog.Versione = "P"
				currentCofog.Datbis =  modelPosFin.getProperty("/infoSottoStrumento/Datbis")
				currentCofog.PercCofog = Number(currentCofog.PercCofog).toFixed(2)
				delete currentCofog.__metadata
				delete currentCofog.Desc
				
				oPosFin.DistribuzioneCofog.push(currentCofog)
			}

			//Capitolo
			oPosFin.UpdateTipCapitolo = []
			oPosFin.UpdateTipCapitolo.push({
				Fikrs: modelPosFin.getProperty("/infoSottoStrumento/Fikrs"),
				Anno: modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr"),
				Fase: modelPosFin.getProperty("/infoSottoStrumento/Fase"),
				Reale: modelPosFin.getProperty("/infoSottoStrumento/Reale"),
				VersioneCapitolo: oDetailAnagrafica.VersioneCapitolo ? oDetailAnagrafica.VersioneCapitolo : 'P',
				VersionePg: "P",
				Eos: "S",
				Prctr: oDetailAnagrafica.AMMINISTAZIONE,
				Fipex: "S" + oDetailAnagrafica.AMMINISTAZIONE.substring(1, oDetailAnagrafica.AMMINISTAZIONE.length ) + oDetailAnagrafica.CAPITOLO +
						oDetailAnagrafica.pg + oDetailAnagrafica.MISSIONE + oDetailAnagrafica.PROGRAMMA + oDetailAnagrafica.AZIONE + oDetailAnagrafica.CATEGORIA + 
						oDetailAnagrafica.CE2 + oDetailAnagrafica.CE3,
				Capitolo: oDetailAnagrafica.CAPITOLO,
				Pg: oDetailAnagrafica.pg,
				Datbis: modelPosFin.getProperty("/infoSottoStrumento/Datbis"),
				DescBreveCapitolo: !oDetailAnagrafica.CODICE_STANDARD_CAPITOLO ?  oDetailAnagrafica.CD_CAPITOLO_DEN_BREVE : (oDenomCapitolo ? oDenomCapitolo.DESC_BREVE : ''),
				DescEstesaCapitolo:  !oDetailAnagrafica.CODICE_STANDARD_CAPITOLO ? oDetailAnagrafica.CD_CAPITOLO_DEN_EST : (oDenomCapitolo ? oDenomCapitolo.DESCR_ESTESA : ''),
				DescBrevePg: !oDetailAnagrafica.CODICE_STANDARD_PG ? oDetailAnagrafica.CD_PG_DEN_BREVE : '',
				DescEstesaPg: !oDetailAnagrafica.CODICE_STANDARD_PG ? oDetailAnagrafica.CD_PG_DEN_EST : '',
				CodiceStdCapitolo: oDetailAnagrafica.CODICE_STANDARD_CAPITOLO ? oDetailAnagrafica.CODICE_STANDARD_CAPITOLO : "000",
				CodiceStdPg: oDetailAnagrafica.CODICE_STANDARD_PG ? oDetailAnagrafica.CODICE_STANDARD_PG : "000"
			})
			oPosFin.UpdateRelatedPosfin = []

			oPosFin.UpdateSstrLog = []
			oPosFin.UpdateSstrLog.push(this.__getItemLogSStr([modelPosFin.getProperty("/infoSottoStrumento/Fikrs"), 
															  modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr"),
															  modelPosFin.getProperty("/infoSottoStrumento/Fase"),
															  modelPosFin.getProperty("/infoSottoStrumento/Reale"),
															  "P", oPosFin.Fipex,
															  modelPosFin.getProperty("/infoSottoStrumento/Datbis"), "ZKPOSFIN", "", "I", "", ""]))
			
			return oPosFin
		},
		onChangeStatusCapitolo: function (oEvent) {
			const modelPosFin = this.getView().getModel("modelPosFin")
			if(!oEvent.getParameter("state")){
				modelPosFin.setProperty("/detailAnagrafica/StatusPg", false)
			} else {
				modelPosFin.setProperty("/detailAnagrafica/StatusPg", true)
			}
		},
		checkNumericPGCapitolo: function (oEvent) {
			const oSource = oEvent.getSource();
			let val = oSource.getValue();
			val = val.replace(/[^\d]/g, '');
			oSource.setValue(val);

			// if(val.length === 4){
				this.onChangeCapitolo()
			// }

		},
		onCheckNumericPG: function (oEvent) {
			let sValue = oEvent.getSource().getValue()
			if(isNaN(Number(sValue)))
				oEvent.getSource().setValue('')
		},
		onCheckPercCofog: function (oEvent) {
			const oSource = oEvent.getSource();
			let val = oSource.getValue();
			if(!Number(val)){
				val = null
				oSource.setValue(val);
			} 

		},
		openHVAutorizzazione: function (sNameFragment, sNameVariable) {
			if(this[sNameVariable]) {
				this[sNameVariable].destroy()
				delete this[sNameVariable]
			}
			if(!this[sNameVariable]) {
				Fragment.load({
					name:"zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.HVAutorizzazioni." + sNameFragment,
					controller: this
				}).then(oDialog => {
					this[sNameVariable] = oDialog;
					this.getView().addDependent(oDialog);
					this[sNameVariable].open();
				})
			} /* else {
				this[sNameVariable].open();
			} */
		},
		//lt filtri per tipologia
		// puoi passare i parametri custom messi nell'xml 
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
				aFilters.push(new Filter("REALE", FilterOperator.EQ, 'R'))
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
			this.resetDialogSearchField(oEvent.getSource());
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
		onPressRicercaAuth: async function (oEvent) {
			const modelPosFin = this.getView().getModel("modelPosFin");
			const modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			modelPosFin.setProperty("/formAutorizzazione/resultsAuth", [])
			modelPosFin.setProperty("/busyAuth", true)
			this.getView().setBusy(true)
			this.openHVAutorizzazione("TableRicercaAuth", "TableRicercaAuth")
			let aFilters= [
				new Filter("Fikrs", FilterOperator.EQ, "S001"),
			]
			aFilters = this._setFiltersForm(aFilters, modelPosFin)
			let aAutorizzazioniAssociate = await this.__getDataPromise("/AutorizzazioniSet",
													[
														new Filter("Fikrs", FilterOperator.EQ, modelPosFin.getProperty("/PosFin/Fikrs")),
														new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/PosFin/Anno")),
														new Filter("Fase", FilterOperator.EQ,modelPosFin.getProperty("/PosFin/Fase")),
														new Filter("Reale", FilterOperator.EQ,modelPosFin.getProperty("/PosFin/Reale")),
														new Filter("Fipex", FilterOperator.EQ,modelPosFin.getProperty("/PosFin/Fipex"))
													]
															,modelHana)
			this.getView().setBusy(false)
			if(aAutorizzazioniAssociate.length > 0) {
				aFilters.push(new Filter({
					filters: function () {
						let aFilters = []
						for(let i =0 ; i < aAutorizzazioniAssociate.length; i++){
							aFilters.push(new Filter("Fincode", FilterOperator.NE, aAutorizzazioniAssociate[i].IdAutorizzazione))
						}
						return aFilters
					}(),
					and: true,
				  }))
			}
			
			modelHana.read("/NuovaAutorizzazioneSet", {
				urlParameters: {
					$expand: "AmminCompetenza"
				},
				filters: aFilters,
				success: (oData) => {

					let ammPos =  [modelPosFin.getProperty("/PosFin").Prctr];
					let iIndex = 0;
					oData.results = jQuery.grep(oData.results, function(record, pos) {
					iIndex = record.AmminCompetenza.results.findIndex((oAmminCompetenza) => {
							return ammPos.includes(oAmminCompetenza.Prctr)
						})
						return record.AllPrctr === true  || iIndex !== -1
					});  

					if(modelPosFin.getProperty("/formAutorizzazione/Item/TipoAut"))
						oData.results = oData.results.filter(auth => auth.Tipo === modelPosFin.getProperty("/formAutorizzazione/Item/TipoAut"))
					modelPosFin.setProperty("/formAutorizzazione/resultsAuth", oData.results)
					modelPosFin.setProperty("/busyAuth", false)
				},
				error: (res) => {
					MessageBox.error("Errore nel recupero delle Autorizzazioni")
					modelPosFin.setProperty("/busyAuth", false)
				}
			})
		},
		onConfirmChoiceAuth: function (oEvent) {
			const modelPosFin = this.getView().getModel("modelPosFin");
			let oSelectedItem = modelPosFin.getProperty(oEvent.getParameter("selectedItem").getBindingContextPath())

			modelPosFin.setProperty("/formCodingBlock/Auth", oSelectedItem)
			modelPosFin.setProperty("/formCodingBlock/Auth/DescrizioneCompatta", oSelectedItem.Beschr)
			modelPosFin.setProperty("/formCodingBlock/DescrInputAuth", oSelectedItem.ZzdescrEstesaFm ? oSelectedItem.ZzdescrEstesaFm : "NULL")
			this.oDialogFormRicercaAuth.close()
		},
		onSaveCodingBlock: function (oEvent) {
			const modelPosFin = this.getView().getModel("modelPosFin");
			const modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let oFormCodingBlock = modelPosFin.getProperty("/formCodingBlock")
			let oPayload = {}
			this.FormCodingBlock.setBusy(true)

			if(modelPosFin.getProperty("/formCodingBlock/nuovaAuth")) {
				let oAuth = modelPosFin.getProperty("/formCodingBlock/Auth")
				if(!oAuth){
					this.FormCodingBlock.setBusy(false)
					return MessageBox.error("Scegliere un'autorizzazione")
				}
				//check percentuali - Perc quota agg
				if(oFormCodingBlock.percentQuotaAggredibilita)
					if(Number(oFormCodingBlock.percentQuotaAggredibilita.replace(",", "."))) {
						if(Number(oFormCodingBlock.percentQuotaAggredibilita.replace(",", ".")) > 100.00){
							this.FormCodingBlock.setBusy(false)
							return MessageBox.error("Percentuale quota aggredibilità è superiore a 100")
						}
					} else {
						this.FormCodingBlock.setBusy(false)
						return MessageBox.error("Percentuale quota aggredibilità non è un valore numerico")
					}
				//check percentuali - Perc APS
				if(oFormCodingBlock.APS)
				if(oFormCodingBlock.checkedPercentAps){
					if(Number(oFormCodingBlock.APS.replace(",", "."))) {
						if(Number(oFormCodingBlock.APS.replace(",", ".")) > 100.00){
							this.FormCodingBlock.setBusy(false)
							return MessageBox.error("Percentuale APS è superiore a 100")
						}
					} else {
						this.FormCodingBlock.setBusy(false)
						return MessageBox.error("Percentuale APS non è un valore numerico")
					}
				}
				let oPosFin = modelPosFin.getProperty("/PosFin")
				oPayload = {
					IdAutorizzazione: oAuth.Fincode,
					Fikrs: oAuth.Fikrs,
					Anno: oPosFin.Anno,
					Fase: oPosFin.Fase,
					Reale: oPosFin.Reale,
					Versione: "P",
					Fipex: oPosFin.Fipex,
					Fictr: modelPosFin.getProperty("/strutturaAmminCentrale/Fictr"),
					Datbis: oPosFin.Datbis,
					FondoOpereProgetti: oFormCodingBlock.FOP ? oFormCodingBlock.FOP : "",
					FlagAiutoPubblicoSviluppo: oFormCodingBlock.checkedPercentAps ? 'X' : '',
					PercAPS: Number(oFormCodingBlock.APS.replace(",", ".")).toFixed(2), //oFormCodingBlock.APS,
					TcrC: oFormCodingBlock.Tcrc,
					TcrF: oFormCodingBlock.Tcrf,
					PercQuotaAgg: Number(oFormCodingBlock.percentQuotaAggredibilita.replace(",", ".")).toFixed(2), //oFormCodingBlock.percentQuotaAggredibilita,
					CodiceStrumento: modelPosFin.getProperty("/infoSottoStrumento/CodiceStrumento"),
					CodiceStrumentoOri: modelPosFin.getProperty("/infoSottoStrumento/CodiceStrumentoOri"),
					CodiceSottostrumento: modelPosFin.getProperty("/infoSottoStrumento/CodiceSottostrumento"),
					DatbisSstr: modelPosFin.getProperty("/infoSottoStrumento/Datbis")
				}
				modelHana.create("/AutorizzazioniSet", oPayload, {
					success: (oData, res) => {
						MessageBox.show("Salvataggio effettuato correttamente")
						this.FormCodingBlock.setBusy(false)
						this.FormCodingBlock.close()
						this.resetFiltriCodingBlock()
					},
					error: (res) => {
						this.FormCodingBlock.setBusy(false)
						//MessageBox.error("Errore nella creazione del Coding Block")
						this.exposeMsgErrCustom(res, "Errore nell'eliminazione del Coding Block")
					}
				})
			} else {
				//this.FormCodingBlock.setBusy(false)
				let oAuth = modelPosFin.getProperty("/formCodingBlock/Auth")
				let oPosFin = modelPosFin.getProperty("/PosFin")
				//check percentuali
				if(oFormCodingBlock.percentQuotaAggredibilita)
					if(Number(oFormCodingBlock.percentQuotaAggredibilita.replace(",", ".")) !== "0.00") {
						if(Number(oFormCodingBlock.percentQuotaAggredibilita.replace(",", ".")) > 100.00){
							this.FormCodingBlock.setBusy(false)
							return MessageBox.error("Percentuale quota aggredibilità è superiore a 100")
						}
					} else {
						this.FormCodingBlock.setBusy(false)
						return MessageBox.error("Percentuale quota aggredibilità non è un valore numerico")
					}
				//check percentuali - Perc APS
				if(oFormCodingBlock.APS)
					if(oFormCodingBlock.checkedPercentAps){
						if(Number(oFormCodingBlock.APS.replace(",", ".")) !== "0.00" ) {
							if(Number(oFormCodingBlock.APS.replace(",", ".")) > 100.00){
								this.FormCodingBlock.setBusy(false)
								return MessageBox.error("Percentuale APS è superiore a 100")
							}
						} else {
							this.FormCodingBlock.setBusy(false)
							return MessageBox.error("Percentuale APS non è un valore numerico")
						}
					}
				oPayload = {
					IdAutorizzazione: oAuth.IdAutorizzazione,
					Fikrs: oAuth.Fikrs,
					Anno: oPosFin.Anno,
					Fase: oPosFin.Fase,
					Reale: oPosFin.Reale,
					Versione: oAuth.Versione,
					Fipex: oPosFin.Fipex,
					Fictr: modelPosFin.getProperty("/strutturaAmminCentrale/Fictr"),
					Datbis: oAuth.Datbis,
					FondoOpereProgetti: oFormCodingBlock.FOP ? oFormCodingBlock.FOP : "",
					FlagAiutoPubblicoSviluppo: oFormCodingBlock.checkedPercentAps ? 'X' : '',
					PercAPS: Number(oFormCodingBlock.APS.replace(",", ".")).toFixed(2), //oFormCodingBlock.APS,
					TcrC: oFormCodingBlock.Tcrc,
					TcrF: oFormCodingBlock.Tcrf,
					PercQuotaAgg:  Number(oFormCodingBlock.percentQuotaAggredibilita.replace(",", ".")).toFixed(2), //oFormCodingBlock.percentQuotaAggredibilita,
					CodiceStrumento: modelPosFin.getProperty("/infoSottoStrumento/CodiceStrumento"),
					CodiceStrumentoOri: modelPosFin.getProperty("/infoSottoStrumento/CodiceStrumentoOri"),
					CodiceSottostrumento: modelPosFin.getProperty("/infoSottoStrumento/CodiceSottostrumento"),
					DatbisSstr: modelPosFin.getProperty("/infoSottoStrumento/Datbis")
				}
				let sUrl = "/" + oAuth.__metadata.uri.split("/")[oAuth.__metadata.uri.split("/").length - 1]
				modelHana.update(sUrl, oPayload, {
					success: async (oDataUpdate, res) => {
						let sUrlAuth = sUrl.replace("Versione='D'", "Versione='P'")
						modelPosFin.setProperty("/CompetenzaAuth/Auth", await this.__getKeyPromise(sUrlAuth, this.getOwnerComponent().getModel("sapHanaS2")))
						MessageBox.show("Salvataggio effettuato correttamente")
						this.FormCodingBlock.setBusy(false)
						this.FormCodingBlock.close()
						this.resetFiltriCodingBlock()
					},
					error: (res) => {
						this.FormCodingBlock.setBusy(false)
						MessageBox.error("Errore sulla modifica del Coding Block")
					}
				})
			}
		},
		onChangeFOP: function (oEvent) {
			const modelPosFin = this.getView().getModel("modelPosFin");
			modelPosFin.setProperty("/detailAnagrafica/FOFP", oEvent.getParameter("selectedIndex") === 0 ? 'FP' : 'FO')
		},
		onSelectionFO: function(oEvent) {
			const modelPosFin = this.getView().getModel("modelPosFin");
			var oCheckboxFp = this.getView().byId("checkboxFP");
			var state = oEvent.getParameter("selected");
			if(state==true){
				oCheckboxFp.setSelected(false);
				modelPosFin.setProperty("/detailAnagrafica/FOFP", 'FO')
			}else{
				modelPosFin.setProperty("/detailAnagrafica/FOFP", '')
			}
			
		},

		onSelectionFP: function(oEvent) {
			const modelPosFin = this.getView().getModel("modelPosFin");
			var oCheckboxFo = this.getView().byId("checkboxFO");
			var state = oEvent.getParameter("selected");
			if(state==true){
				oCheckboxFo.setSelected(false);
				modelPosFin.setProperty("/detailAnagrafica/FOFP", 'FP')
			}else{
				modelPosFin.setProperty("/detailAnagrafica/FOFP", '')
			}
		},
		checkEnableSalvaCB: function (bNuovaAuth, sFikrs, sFikrsLog, sCodStr, sCodStrLog, sCodStrOri, sCodStrOriLog, sCodSStr, sCodSStrLog, sTipoEsposizione) {
			if(!bNuovaAuth) {
				if(sFikrsLog && sCodStrLog !== "000000000000" && sCodStrOriLog !== "000000000000" && sCodSStrLog !== "000000000000") {
					if(sFikrs === sFikrsLog && sCodStr === sCodStrLog && sCodStrOri === sCodStrOriLog && sCodSStr === sCodSStrLog)
						return true
					else
						return false
				} else {
					if(sTipoEsposizione === "0")
						return true
					else 
						return false
				}
 			} else {
				return true
			}
		},
		checkEnableDeleteCB: function (bNuovaAuth, sFikrs, sFikrsLog, sCodStr, sCodStrLog, sCodStrOri, sCodStrOriLog, sCodSStr, sCodSStrLog) {

			if(sFikrsLog && sCodStrLog && sCodStrOriLog && sCodSStrLog) {
				if(sFikrs === sFikrsLog && sCodStr === sCodStrLog && sCodStrOri === sCodStrOriLog && sCodSStr === sCodSStrLog)
					return true
				else 
					return false
			} else {
				return false
			}
 			
		},
		onDeleteCodingBlock: function () {
			const modelPosFin = this.getView().getModel("modelPosFin")
			const modelHana = this.getOwnerComponent().getModel("sapHanaS2")	

			let oAuth = modelPosFin.getProperty("/formCodingBlock/Auth")
			let oSottostrumento = modelPosFin.getProperty("/infoSottoStrumento/")


			var path = oAuth.__metadata.uri.split("/")[oAuth.__metadata.uri.split("/").length - 1]
			
			var ret = path.replace('AutorizzazioniSet','');
			ret = ret.slice(1, -1);
			ret = ret.split(",")

			var datiEstrattiDalPath = {};
			for (let i = 0; i < ret.length; i++) {
				const el = ret[i];
				var splittato = el.split("=");
				datiEstrattiDalPath[splittato[0]] = splittato[1];				
			}

			var attributi = {
				"CodiceStrumento" : "'" + oSottostrumento.CodiceStrumento + "'",
				"CodiceStrumentoOri" : "'" + oSottostrumento.CodiceStrumentoOri + "'",
				"CodiceSottostrumento" : "'" + oSottostrumento.CodiceSottostrumento + "'",
				"DatbisSstr" : "datetime'"+oSottostrumento.Datbis.toISOString().replace(".000Z","'"),				
				"Fikrs" : datiEstrattiDalPath.Fikrs,
				"Anno" : datiEstrattiDalPath.Anno,
				"Fase" : datiEstrattiDalPath.Fase,
				"Reale" : datiEstrattiDalPath.Reale,
				"Versione" : datiEstrattiDalPath.Versione,
				"Fipex" : datiEstrattiDalPath.Fipex.replaceAll(".",""),
				"Fictr" : datiEstrattiDalPath.Fictr,
				"IdAutorizzazione" : datiEstrattiDalPath.IdAutorizzazione,
				"Datbis" : datiEstrattiDalPath.Datbis //"datetime'"+datiEstrattiDalPath.Datbis.toISOString().replace(".000Z","'")
			}

			var arrayStringhe = [];
			for (let z = 0; z <  Object.keys(attributi).length; z++) {
				const key =  Object.keys(attributi)[z];
				arrayStringhe.push(key + "=" + attributi[key])
			}

			var sUrl = "/AutorizzazioniSet(" + arrayStringhe.join(",") + ")";


			//LT CAMBIO REGISTRO
			var that = this;
			
	
			sap.m.MessageBox.show(
				"Continuando si cancellerà il Coding Block. Continuare?", {
					icon: sap.m.MessageBox.Icon.QUESTION,
					title: "Conferma Cancellazione Coding Block",
					actions: ["Ok","Annulla"],
					onClose: function (sButton) {
						if (sButton === "Ok") {
							that.FormCodingBlock.setBusy(true)
							//lt forzo il cambio stato e gli mando anche il sottostrumento
							modelHana.setUseBatch(false)
							modelHana.remove(sUrl, {
									success: (oData, res) => {
										modelHana.setUseBatch(true)
										MessageBox.show("Coding Block Eliminato correttamente")
										that.FormCodingBlock.setBusy(false)
										that.FormCodingBlock.close()
										that.resetFiltriCodingBlock()
										//reset autorizzazione selezionata
										modelPosFin.setProperty("/CompetenzaAuth/AuthAssociata", null)
										modelPosFin.setProperty("/CompetenzaAuth/Auth", null)
										modelPosFin.setProperty("/CompetenzaAuth/DescrInputAuth",null)
										//
									},
									error: (res) => {
										modelHana.setUseBatch(true)
										that.FormCodingBlock.setBusy(false)
										that.exposeMsgErrCustom(res, "Errore nella creazione del Coding Block")
									}
								})
							
						} else {
							return;
						}
					},
					styleClass: "sapUiResponsivePadding--header sapUiResponsivePadding--content sapUiResponsivePadding--footer"
				}
			);
		},
		onExpandStabilizzata: function (oEvent) {
			const modelHana = this.getOwnerComponent().getModel("sapHanaS2")  
			const modelPosFin = this.getView().getModel("modelPosFin");
			let aAnnoFase = modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")

			this.getView().setModel(new JSONModel({
				stabilizzateResults: [],
				DescrGruppo: "",
				busy: true,
				colonneAnni: {
					primoAnno: aAnnoFase,
					secondoAnno: (parseInt(aAnnoFase) + 1).toString(),
					terzoAnno: (parseInt(aAnnoFase) + 2).toString()
				}
			}), "modelStabilizzate")

			var oButton = oEvent.getSource(),
			oView = this.getView();

			//Estrazione Stabilizzate
			let aFilters = [
				new Filter("Fikrs", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Fikrs")),
				//new Filter("Fase", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Fase")),
				new Filter("AnnoFase", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
				new Filter("FincodeSpe", FilterOperator.EQ, modelPosFin.getProperty("/CompetenzaAuth/Auth/IdAutorizzazione")),
			]
			let mStabilizzate = this.getView().getModel("modelStabilizzate")
			this.__getDataPromise("/StabilizzateSet", aFilters , modelHana , {})
				.then((res)=>{
					let results = res.sort((a,b) => parseInt(a.AnnoMovS) - parseInt(b.AnnoMovS))
					this.popolateResults(results, aAnnoFase);
					var descrGruppo = results && results.length > 0 ? results[0].DescrGruppo : "";
					mStabilizzate.setProperty("/stabilizzateResults", results)
					mStabilizzate.setProperty("/DescrGruppo", descrGruppo)
					let aAnniTripFirst = [aAnnoFase, (parseInt(aAnnoFase) + 1).toString(), (parseInt(aAnnoFase) + 2).toString()]
					let aDatiTripletta = this._createLabels(results, aAnniTripFirst, modelPosFin.getProperty("/CompetenzaAuth/Auth/IdAutorizzazione"),aAnniTripFirst)
					mStabilizzate.setProperty("/triennioCurrent", aDatiTripletta)
					mStabilizzate.setProperty("/busy", false)
					let aCalendarioTriennioSel = this._createCalTriennio(results, aAnnoFase)
					mStabilizzate.setProperty("/selezionePeriodi", aCalendarioTriennioSel)
					mStabilizzate.setProperty("/selPeriodo",aCalendarioTriennioSel[0].value)
					mStabilizzate.setProperty("/enableBack", false)
					mStabilizzate.setProperty("/enableForth", true)
				})
				.catch(err => {
					mStabilizzate.setProperty("/busy", false)
				})

			// create popover
			if (!this.popOverStabilizzate) {
				Fragment.load({
					id: oView.getId(),
					name: "zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.PopOverStabilizzate",
					controller: this
				}).then((oPopover) => {
					oView.addDependent(oPopover);
					this.popOverStabilizzate = oPopover
					oPopover.openBy(oButton)
				});
			} else {
				this.popOverStabilizzate.openBy(oButton)
			}
			// this.popOverStabilizzate.then(function(oPopover) {
			// 	oPopover.openBy(oButton);
			// });
		},

		onExpandInfoPercent: function(oEvent){
			var oButton = oEvent.getSource(),
			oView = this.getView();

			if (!this.popOverInfoPercent) {
				Fragment.load({
					id: oView.getId(),
					name: "zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.PopOverInfoPercent",
					controller: this
				}).then((oPopover) => {
					oView.addDependent(oPopover);
					this.popOverInfoPercent = oPopover
					oPopover.openBy(oButton)
				});
			} else {
				this.popOverInfoPercent.openBy(oButton)
			}
		},

		popolateResults: function (results, aAnnoFase){
			
			if(results.length > 0){
				var centoAnni = []
				for (let i = 0; i < 99; i++) {
					centoAnni.push((parseInt(aAnnoFase) + i).toString())
				}
				var matrice = results[0];				
				for(let i = 0; i < centoAnni.length ; i++){
					var anno = centoAnni[i];
					var checkAnnoPresente = jQuery.grep(results, function(record, pos) {
						return record.AnnoMovE === anno
					});      
					
					if(checkAnnoPresente.length === 0){
							results.push({
								AnnoFase: aAnnoFase,
								AnnoMovE:anno,
								AnnoMovS:anno,
								DescrEstesa:"",
								DescrEstesaEnt:matrice.DescrEstesaEnt,
								DescrEstesaSpe:matrice.DescrEstesaSpe,
								Eos:"",
								CodiceAmmin:"",
								Fase:matrice.Fase,
								Fikrs:matrice.Fikrs,
								FincodeEnt:matrice.FincodeEnt,
								FincodeSpe:matrice.FincodeSpe,
								IdGruppo:matrice.IdGruppo,
								RcImpoVersEng:"0.000",
								RcImpoVersEvg:"0.000",
								RcImpoVersEvg1:"0.000",
								TotPrevDlbCpE:"0.000",
								TotPrevDlbCpS:"0.000",
								TotPrevDlbCsE:"0.000",
								TotPrevDlbCsS:"0.000"
							})
						}		
					
					}
					
				}
				
				return results
			},
		_createLabels: function (aStab, aAnniTrip, fincodeSelected, aAnniTripVersamenti) {
			const modelPosFin = this.getView().getModel("modelPosFin")
			const sAnnoFase = modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")
			const formatFloat = NumberFormat.getFloatInstance({
				"groupingEnabled": true,  
				"groupingSeparator": '.', 
				"groupingSize": 3, 
				"decimalSeparator": ",",
				"decimals": 2
			})

			let aDati = []
			let oDatiEntrata = {
				primaColonnaDescr: "",
			}
			let labelsEntrata = {
				primaColonnaDescr: "Entrata",
			}
			aDati.push(labelsEntrata)
			let aDatiEntrata = []
			let oDatiSpesa = {}
			let aFincodeSpeDistinct = aStab.reduce(function (a, d) {
				if (a.indexOf(d.FincodeSpe) === -1) {
				  a.push(d.FincodeSpe);
				}
				return a;
			 }, []);

			//Entrata
			for (let index = 0; index < aAnniTrip.length; index++) {
				let oTriennio  = aStab.find(it => it.AnnoMovS === aAnniTrip[index])			
				if(index == 0) {
					oDatiEntrata = {
						primaColonnaDescr: "",
						secondaColonnaDescr: oTriennio.DescrEstesaEnt,
						primoAnnoCP: formatFloat.format(oTriennio['TotPrevDlbCpE']),
						primoAnnoCS: oTriennio['TotPrevDlbCsE'],
						primoAnnoCPRaw : oTriennio['TotPrevDlbCpE'],
						fincode: oTriennio.FincodeEnt,
						isAuth: true
					}
				}
				if(index == 1){
					oDatiEntrata.secondoAnnoCP  = formatFloat.format(oTriennio['TotPrevDlbCpE'])
					oDatiEntrata.secondoAnnoCPRaw = oTriennio['TotPrevDlbCpE']
					oDatiEntrata.secondoAnnoCS  = oTriennio['TotPrevDlbCsE']
				}
				if(index == 2){
					oDatiEntrata.terzoAnnoCP  = formatFloat.format(oTriennio['TotPrevDlbCpE'])
					oDatiEntrata.terzoAnnoCPRaw = oTriennio['TotPrevDlbCpE']
					oDatiEntrata.terzoAnnoCS  = oTriennio['TotPrevDlbCsE']
				}
			}
			
			aDati.push(oDatiEntrata)

			//Versamenti - solo per il primo triennio
			if(aAnniTripVersamenti.length && sAnnoFase == aAnniTripVersamenti[0]){
				aDati.push({ //prima riga con anni Triennio precedente
					primaColonnaDescr: "",
					isAuth: false,
					secondaColonnaDescr: "Versamenti",
					primoAnnoCP: (parseInt(sAnnoFase) - 1 ).toString(),
					annoVers: "anno",
					secondoAnnoCP:(parseInt(sAnnoFase) - 2 ).toString(),
					terzoAnnoCP: (parseInt(sAnnoFase) - 3 ).toString()
				})
				aDati.push({ //seconda riga importi versamenti
					primaColonnaDescr: "",
					secondaColonnaDescr: "",
					primoAnnoCP: (() => {
						let oPrimoAnno = aStab.find(st => st.AnnoMovS === aAnniTripVersamenti[0])
						return oPrimoAnno.RcImpoVersEng ? formatFloat.format(oPrimoAnno.RcImpoVersEng) : null //oPrimoAnno.RcImpoVersEvg1 : null 
					})(),
					secondoAnnoCP:(() => {
						let oSecondoAnno = aStab.find(st => st.AnnoMovS === aAnniTripVersamenti[1])
						return oSecondoAnno.RcImpoVersEvg ? formatFloat.format(oSecondoAnno.RcImpoVersEvg) : null 
					})(),
					terzoAnnoCP: (() => {
						let oTerzoAnno = aStab.find(st => st.AnnoMovS === aAnniTripVersamenti[2])
						return oTerzoAnno.RcImpoVersEvg1 ? formatFloat.format(oTerzoAnno.RcImpoVersEvg1) : null 
					})()
				})
			}

			//Spesa
			//Prima Colonna
			let aDatiSpesa = []
			let labelsSpesa = {
				primaColonnaDescr: "Spesa",
				secondaColonnaDescr: ""
			}
			aDati.push(labelsSpesa)
			let labelsSpesaPerCent = {
				primaColonnaDescr: "",
				secondaColonnaDescr: "Percentuali",
				isAuth: false
			}	
			aDati.push(labelsSpesaPerCent)

			for (let index = 0; index < aFincodeSpeDistinct.length; index++) {
				const sDistinctSpe = aFincodeSpeDistinct[index];
				let aDistinctSpeFin = aStab.filter(sp => sp.FincodeSpe === sDistinctSpe)
				let aDistinctSpe = aDistinctSpeFin.filter(it => aAnniTrip.find(a => a === it.AnnoMovS))
				//let oTriennio  = aDistinctSpe.find(it => it.AnnoMovS === aAnniTrip[index])

				//aDistinctSpe = aDistinctSpe.filter(it =>  aAnniTrip.find(a => a === it.AnnoMovS))
				

				let oDatiSpesa = {}
				let oDatiAmmin = {}
				let aDistinctSpeTrip = []
				let righeAmministrazioni= [];
				let listaAmm = [] //lista amministrazioni per triennio
				for (let i = 0; i < aAnniTrip.length; i++) {
					const anno = aAnniTrip[i];
					var adminForYear = aDistinctSpeFin.filter(it => it.AnnoMovS === anno)
					var totPrevDlbCpS = 0
					//lt ciclo gli anni per delineare i valori totali che vanno modificati
					adminForYear.forEach(el => {
						if(listaAmm.indexOf(el.CodiceAmmin) === -1)listaAmm.push(el.CodiceAmmin);
						totPrevDlbCpS = totPrevDlbCpS + parseInt(el.TotPrevDlbCpS)
					});
					//clono
					var cloneTrip = jQuery.extend(true, {}, adminForYear[0]);
					cloneTrip.TotPrevDlbCpS = totPrevDlbCpS.toString()
					aDistinctSpeTrip.push(cloneTrip)
				}
				

				for (let j = 0; j < aDistinctSpeTrip.length; j++) {
					const oFincodeSpe = aDistinctSpeTrip[j];
					if(j == 0) {
						oDatiSpesa = {
							...oDatiSpesa,
							primaColonnaDescr: "",
							secondaColonnaDescr: oFincodeSpe.DescrEstesaSpe,
							primoAnnoCP: formatFloat.format(oFincodeSpe['TotPrevDlbCpS']),
							primoAnnoCPRaw: oFincodeSpe['TotPrevDlbCpS'],
							primoAnnoCS: oFincodeSpe['TotPrevDlbCsS'],
							fincode: oFincodeSpe.FincodeSpe,
							isAuth: true,
						}
						if(fincodeSelected == oFincodeSpe.FincodeSpe){
							oDatiSpesa.fincodeSelected = "true"
						} else {
							oDatiSpesa.fincodeSelected = "false"
						}
					}
					if(j == 1) {
						oDatiSpesa.secondoAnnoCP  = formatFloat.format(oFincodeSpe['TotPrevDlbCpS'])
						oDatiSpesa.secondoAnnoCPRaw = oFincodeSpe['TotPrevDlbCpS']
						oDatiSpesa.secondoAnnoCS  = oFincodeSpe['TotPrevDlbCsS']
					}
					if(j == 2) {
						oDatiSpesa.terzoAnnoCP  = formatFloat.format(oFincodeSpe['TotPrevDlbCpS'])
						oDatiSpesa.terzoAnnoCPRaw = oFincodeSpe['TotPrevDlbCpS']
						oDatiSpesa.terzoAnnoCS  = oFincodeSpe['TotPrevDlbCsS']
					}
				}
				var lista = []
				
				
				//imposto in ordine di amministrazione
				listaAmm = listaAmm.sort((a,b) => a - b)
				for (let i = 0; i < listaAmm.length; i++) {
					const elAmmin = listaAmm[i];
					oDatiAmmin = {
						...oDatiAmmin,
						primaColonnaDescr: "",
						//secondaColonnaDescr: `${elAmmin}`,
						detailAdmin: `${elAmmin}`,
						isAuth: false,
						isAmmin: true											
					}

					for (let z = 0; z < aAnniTrip.length; z++) {
						var totaleAmm = 0
						const anno = aAnniTrip[z];
						
						let anniAmministrazione = aDistinctSpeFin.filter(it => it.AnnoMovS === anno && it.CodiceAmmin === elAmmin)
						anniAmministrazione.forEach(year => {
							totaleAmm = totaleAmm + parseInt(year.TotPrevDlbCpS)
						});				
						if(z == 0) {
							oDatiAmmin.primoAnnoCP = formatFloat.format(totaleAmm.toString())	
						}
						if(z == 1) {
							oDatiAmmin.secondoAnnoCP = formatFloat.format(totaleAmm.toString())
						}
						if(z == 2) {
							oDatiAmmin.terzoAnnoCP = formatFloat.format(totaleAmm.toString())
			
						}		
					}
					lista.push(oDatiAmmin)
				}
				aDati.push(oDatiSpesa)
				aDatiSpesa.push(oDatiSpesa)
				if(listaAmm.length > 0)	{
					aDati.push({
						secondaColonnaDescr: "Dettaglio Amministrazioni",
						isAuth: false,
						isAmmin: true
					})
					aDati= [...aDati, ...lista ]
				}	

			}

			aDati = this._createPerCentStabilizzate(sAnnoFase , aDati,aAnniTripVersamenti)
			return aDati
		},

		_createPerCentStabilizzate: function (sAnnoFase , aDati,aAnniTripVersamenti) {
			const formatFloat = NumberFormat.getFloatInstance({
				"groupingEnabled": true,  
				"groupingSeparator": '.', 
				"groupingSize": 3, 
				"decimalSeparator": ",",
				"decimals": 2
			})

			//lt recupero i valori totali e calcolo la %
			var rowsImporti = aDati.slice(sAnnoFase === aAnniTripVersamenti[0] ? 6 : 3,aDati.length).filter(attribute => !attribute.isAmmin)
			let singleRow = {
				primoAnnoCP : 0,
				secondoAnnoCP : 0,
				terzoAnnoCP : 0
			}

			rowsImporti.forEach(row => {
				singleRow.primoAnnoCP 	= singleRow.primoAnnoCP 	+ parseFloat(row.primoAnnoCPRaw)
				singleRow.secondoAnnoCP = singleRow.secondoAnnoCP 	+ parseFloat(row.secondoAnnoCPRaw)
				singleRow.terzoAnnoCP 	= singleRow.terzoAnnoCP 	+ parseFloat(row.terzoAnnoCPRaw)
			});


			var percentPrimoAnno 	= parseFloat(aDati[1].primoAnnoCPRaw) 	=== 0 ? 0 : parseFloat(singleRow.primoAnnoCP).toFixed(2) / parseFloat(aDati[1].primoAnnoCPRaw) * 100.00 
			var percentSecondoAnno 	= parseFloat(aDati[1].secondoAnnoCP) 	=== 0 ? 0 : parseFloat(singleRow.secondoAnnoCP).toFixed(2) / parseFloat(aDati[1].secondoAnnoCPRaw) * 100.00 
			var percentTerzoAnno 	= parseFloat(aDati[1].terzoAnnoCP)	 	=== 0 ? 0 : parseFloat(singleRow.terzoAnnoCP).toFixed(2) / parseFloat(aDati[1].terzoAnnoCPRaw) * 100.00 


			aDati[sAnnoFase === aAnniTripVersamenti[0] ? 5 : 2].primoAnnoCP = formatFloat.format(percentPrimoAnno)
			aDati[sAnnoFase === aAnniTripVersamenti[0] ? 5 : 2].secondoAnnoCP = formatFloat.format(percentSecondoAnno)
			aDati[sAnnoFase === aAnniTripVersamenti[0] ? 5 : 2].terzoAnnoCP = formatFloat.format(percentTerzoAnno)
			if(aDati[sAnnoFase === aAnniTripVersamenti[0] ? 5 : 2].primoAnnoCP === ""  )  aDati[sAnnoFase === aAnniTripVersamenti[0] ? 5 : 2].primoAnnoCP   = '0'
			if(aDati[sAnnoFase === aAnniTripVersamenti[0] ? 5 : 2].secondoAnnoCP === "")  aDati[sAnnoFase === aAnniTripVersamenti[0] ? 5 : 2].secondoAnnoCP = '0' 
			if(aDati[sAnnoFase === aAnniTripVersamenti[0] ? 5 : 2].terzoAnnoCP === ""  )  aDati[sAnnoFase === aAnniTripVersamenti[0] ? 5 : 2].terzoAnnoCP   = '0' 		
			
			return aDati
		
		},
		_createCalTriennio: function (aStab, aAnnoFase) {
			
			let aAnniDistinct = aStab.reduce(function (a, d) {
				if (a.indexOf(d.AnnoMovS) === -1) {
				  a.push(d.AnnoMovS);
				}
				return a;
			 }, []);
			 let oLabelPeriodi = {}
			 let aLabelPeriodi = []
			 let sPeriodo = ""
			 let iteratore = 1
			 var centoAnni = []
				for (let i = 0; i < 99; i++) {
					centoAnni.push((parseInt(aAnnoFase) + i).toString())
				}
			 for(let i = 0; i < centoAnni.length ; i++){
				
				if( iteratore== 1) {
					sPeriodo = centoAnni[i]
					
				}else {
					sPeriodo +=  "-" +  centoAnni[i]
				}
				if((i +1) % 3 == 0) {
					iteratore = 0
					
					aLabelPeriodi.push({text: sPeriodo, value: i+1, aPeriodi: sPeriodo.split("-")})
				}
				iteratore++
			 }
			 return aLabelPeriodi
		},
		setPeriodStabilizzate: function(oEvent) {
			let mStabilizzate = this.getView().getModel("modelStabilizzate")
			let modelPosFin = this.getView().getModel("modelPosFin")
			mStabilizzate.setProperty("/busy", true)
			let sPeriod = oEvent.getParameter("selectedItem").getProperty("text")
			let aPeriod = sPeriod.split("-")

			//colonne tabella
			mStabilizzate.setProperty("/colonneAnni",{
				primoAnno: aPeriod[0],
				secondoAnno: aPeriod[1],
				terzoAnno: aPeriod[2]
			})
			let aPeriodiSelezioni = mStabilizzate.getProperty("/selezionePeriodi")

			let resultsStabilizzate = mStabilizzate.getProperty("/stabilizzateResults")
			let aDatiTripletta = this._createLabels(resultsStabilizzate, aPeriod, modelPosFin.getProperty("/CompetenzaAuth/Auth/IdAutorizzazione"), aPeriodiSelezioni[0].aPeriodi)
			mStabilizzate.setProperty("/triennioCurrent", aDatiTripletta)

			//disabilito/abilito pulsanti avanti e indietro
			let sCurrentPeriodo = mStabilizzate.getProperty("/selPeriodo")
			let indexCurrentPeriod = aPeriodiSelezioni.findIndex(it => it.value === parseInt(sCurrentPeriodo) )

			if(indexCurrentPeriod === aPeriodiSelezioni.length - 1){
				mStabilizzate.setProperty("/enableForth", false)
			} else {
				mStabilizzate.setProperty("/enableForth", true)
			} 
			if(indexCurrentPeriod === 0){
				mStabilizzate.setProperty("/enableBack", false)
			} else {
				mStabilizzate.setProperty("/enableBack", true)
			}
			//fine disabilità

			mStabilizzate.setProperty("/busy", false)
		},
		onPressChangeArrow: function (oEvent) {
			//debugger
			this.popOverStabilizzate.setInitialFocus()
			let mStabilizzate = this.getView().getModel("modelStabilizzate")
			let modelPosFin = this.getView().getModel("modelPosFin")

			let customData = oEvent.getSource().getCustomData().find(cd => cd.getProperty("key") === "Arrow" )
			let sActionDirection = customData.getValue()

			mStabilizzate.setProperty("/busy", true)

			let aPeriodo = mStabilizzate.getProperty("/colonneAnni")
			let aPeriodiSelezioni = mStabilizzate.getProperty("/selezionePeriodi")
			let sCurrentPeriodo = mStabilizzate.getProperty("/selPeriodo")
			let oNextPeriodo = {}
			let indexCurrentPeriod = null

			if(sActionDirection === "Dx"){
				oNextPeriodo = aPeriodiSelezioni.find(ps => ps.value === parseInt(sCurrentPeriodo) + 3)
				indexCurrentPeriod = aPeriodiSelezioni.findIndex(it => it.value === parseInt(sCurrentPeriodo) + 3)
				mStabilizzate.setProperty("/selPeriodo", oNextPeriodo.value)
			} 
			if(sActionDirection === "Sx"){
				oNextPeriodo = aPeriodiSelezioni.find(ps => ps.value === parseInt(sCurrentPeriodo) - 3)
				indexCurrentPeriod = aPeriodiSelezioni.findIndex(it => it.value === parseInt(sCurrentPeriodo) - 3)
				mStabilizzate.setProperty("/selPeriodo", oNextPeriodo.value)
			}
			if(sActionDirection === "Initial"){
				indexCurrentPeriod = 0
				oNextPeriodo = aPeriodiSelezioni.find(ps => ps.value === 3)
				mStabilizzate.setProperty("/selPeriodo", 3)
			}
			//disabilito/abilito pulsanti avanti e indietro
			
			if(indexCurrentPeriod === aPeriodiSelezioni.length - 1){
				mStabilizzate.setProperty("/enableForth", false)
			} else {
				mStabilizzate.setProperty("/enableForth", true)
			} 
			if(indexCurrentPeriod === 0){
				mStabilizzate.setProperty("/enableBack", false)
			} else {
				mStabilizzate.setProperty("/enableBack", true)
			}
			//aggiorno colonne anni
			mStabilizzate.setProperty("/colonneAnni",{
				primoAnno: oNextPeriodo.aPeriodi[0],
				secondoAnno: oNextPeriodo.aPeriodi[1],
				terzoAnno: oNextPeriodo.aPeriodi[2]
			})
			let resultsStabilizzate = mStabilizzate.getProperty("/stabilizzateResults")
			let aDatiTripletta = this._createLabels(resultsStabilizzate, oNextPeriodo.aPeriodi, modelPosFin.getProperty("/CompetenzaAuth/Auth/IdAutorizzazione"), aPeriodiSelezioni[0].aPeriodi)
			mStabilizzate.setProperty("/triennioCurrent", aDatiTripletta)
			mStabilizzate.setProperty("/busy", false)
		},

		

		//--------------------FINE LOGICA FRAGMENT ------------------------------------\\
		_openBusyDialog: function(sText) {
			sText = "Sto caricando i dati";
			// instantiate dialog
			// if (!this._dialog) {
			sap.ui.getCore()._dialog = sap.ui.xmlfragment("zsap.com.r3.cobi.s4.gestposfinnv.view.BusyDialog", this);
			if (sText) {
				sap.ui.getCore()._dialog.setText(sText);
			}
			this.getView().addDependent(sap.ui.getCore()._dialog);
			// }

			// open dialog
			// jQuery.sap.syncStyleClass("sapUiSizeCompact", this.getView(), this._dialog);
			sap.ui.getCore()._dialog.open();
		},

		closeBusyDialog: function() {
			try {
				if (sap.ui.getCore()._dialog) {
					sap.ui.getCore()._dialog.close();
					sap.ui.getCore()._dialog.destroy();
				}
			} catch (error) {
				//Popup già chiusa
			}
		},
		setModelFilter: function() {
				var oFilter = {
					eos: "",
					posfin: "",
					fincode: "",
					autColl: "",
					struttAmm: "",
					prctr: "",
					codCap: "",
					strumento: "",
					sStrumento: "",
					strumentoOr: "",
					codCdr: "",
					keyAnno: "",
				}
				this.getView().setModel(new JSONModel(oFilter), "modelFilter");
		},
		popolateModelFilter: function() {

			let modelPosFin = this.getView().getModel("modelPosFin")
			let modelData = modelPosFin.getData()
			let posFin = modelPosFin.getProperty("/PosFin")
			let auth = modelPosFin.getProperty("/CompetenzaAuth/Auth")		
			let onAuthCollegata = modelPosFin.getProperty("/CompetenzaAuth/AuthAssociata")		
			let sottostrumento = modelPosFin.getProperty("/infoSottoStrumento")	
			let strutturaAmminCentrale = modelPosFin.getProperty("/strutturaAmminCentrale")	
			var oFilter = {
				eos: posFin.Eos,
				posfin: posFin.Fipex,
				fincode: auth ? auth.IdAutorizzazione : "",
				autColl: onAuthCollegata ? onAuthCollegata.SeqFondoLe : "",
				struttAmm: auth ? auth.Fictr : "",
				prctr: posFin.Prctr,
				codCap: posFin.Capitolo,
				strumento:sottostrumento.CodiceStrumento,
				sStrumento: sottostrumento.CodiceSottostrumento,
				strumentoOr: sottostrumento.CodiceStrumentoOri,
				codCdr: strutturaAmminCentrale.CodiceCdr,
				keyAnno: parseInt(this.getView().getModel("modelAnno").getData()[0].keyAnno),
			}
			this.getView().setModel(new JSONModel(oFilter), "modelFilter");
		},

		onResetDati: function() {
			this.getView().setModel(new JSONModel([]), "modelTable");
			this.getView().setModel(new JSONModel([]), "modelAppoggio");
			this.getView().setModel(new JSONModel([]), "modelTableComp");
			this.getView().setModel(new JSONModel([]), "modelTableCassa");
			this.getView().setModel(new JSONModel({}), "modelPluri")
			this.getView().setModel(new JSONModel([]), "modelTableSac")
			this.getView().setModel(new JSONModel([]), "modelTableSacCa")
			this.getView().setModel(new JSONModel([]), "modelTableSacCaVaRes")
			this.getView().setModel(new JSONModel([]), "modelTableCassaDA")
			this.getView().setModel(new JSONModel([]), "modelRes")
			//this._resetModelTable()

			this.getView().byId("tableSac").setVisible(true);
			this.setModelFilter();
			this.open = false;
			//this.firstTime = true;
		},

		functionTemp: function(sIdTable, sIdColumnListItem, sModel, sText, sNameCell, isFirstQuadro) {
			this.addCol(sIdTable, sIdColumnListItem, sModel, sText, sNameCell, isFirstQuadro);
		},

		addCol: function(sIdTable, sIdColumnListItem, sModel, sText, sNameCell, isFirstQuadro) {
			var that = this;
			// var ownerComp = that.getOwnerComponent().getModel("modelNavFondo")
			var sTable = this.getView().byId(sIdTable),
				sAnnoKey, sAnnoValue,
				// intEsercizio = this.getView().getModel("modelAnno").getData()[0].keyAnno,
				//modelFilter>/keyAnno
				//intEsercizio = parseInt(this.getView().byId("selectAnnicassa").getSelectedKey()),
				intEsercizio = parseInt(this.getView().getModel("modelAnno").getData()[0].keyAnno),
				sRecord = {},
				arrRelYear = [];

			//var numColonne = this._countImporti("modelTableCassa");
			var j = 0;

			//aggiungo le covlonne
			for (var i = 0; i < 3; i++) {
				//var sNumProperty = this.getView().byId("selectAnnicassa").getSelectedItem().getBindingContext("modelAnno").getProperty(
				var sNumProperty = this.getView().getModel("modelAnno").getData()[0].keyProperty + j;
				// if (i === 100) {
				// 	sTable.addColumn(new sap.m.Column({
				// 		header: new sap.m.Button({
				// 			icon: "sap-icon://navigation-right-arrow",
				// 			press: function() {
				// 				that.onPressChangeRangeRight();
				// 			},
				// 			type: sap.m.ButtonType.Emphasized,
				// 			enabled: "{=${modelVisibleColumn>/FINAL_Range} === 'ANNO100' ? false : true }"
				// 		}),
				// 		width: "1rem",
				// 		visible: "{= ${modelVisibleColumn>/FINAL_Range} === '' ? false : true }"

				// 	}));
				// } else
				// {
				if (sNumProperty.toString().length === 1) {
					var sJay = "00" + sNumProperty.toString();
				} else if (sNumProperty.toString().length === 2) {
					var sJay = "0" + sNumProperty.toString();
				} else if (sNumProperty.toString().length === 3) {
					var sJay = sNumProperty.toString();
				}
				sAnnoKey = this.recuperaTestoI18n(sNameCell) + " " + (intEsercizio + i);
				var column = new sap.m.Column({
					header: new sap.m.Label({
						text: sAnnoKey,
						design: "Bold"
							// text: "{modelForYear>/" + sAnnoKey + "}"
							// text: "{modelForYear>/Anno" + j.toString() + "}"
					}),
					width: "10rem",
					// visible: "{modelVisibleColumn>/" + sAnnoKey + "}",
					// visible: "{modelVisibleColumn>/ANNO" + j.toString() + "}",
					hAlign: "End"
				})
				sTable.addColumn(column);

				// sRecord[intEsercizio + i] = sAnnoKey;
				// this.deleteCells(sIdColumnListItem);
				if (this.firstTime === true || isFirstQuadro) {
					this.getView().byId(sIdColumnListItem).addCell(
						new sap.m.Text({
							text: "{" + sModel + ">" + sText + sJay.toString() + "}",
							textAlign: "Right",
							// editable: false
							// change: function(oEvent) {
							// 	that.onChangeNumberFormat(oEvent);
							// }
						}));
				}

				j++;
				// }
			}
			//! lt levo la propietà this.firstTime = false;
			// this.getView().setModel(new JSONModel(sRecord), "modelYearsRel");
		},

		deleteCells: function(sIdColumnListItem) {
			var columnListItem = this.getView().byId(sIdColumnListItem);
			var sCells = columnListItem.getCells();
			for (var i = 1; i < sCells.length; i++) {
				var cellToRemove = sCells[i];
				columnListItem.removeCell(cellToRemove);
				cellToRemove.destroy();
			}
			var oTable = this.getView().byId("idTableyear"); // Sostituisci con l'ID effettivo della tua tabella
			oTable.rerender();
			oTable.unbindAggregation("items");
			var oVBox = new sap.m.VBox();
			oVBox.addItem(new sap.m.Text({
				text: "{modelTable>ViewLabel}",
				visible: "{= ${modelTable>FlagGriglia} === 'ALIGNR_RIGHT' ? true : false}",
			}).addStyleClass("sapUiMediumMarginBegin"));
			oVBox.addItem(new sap.m.Text({
				// styleClass: "boldCss",
				text: "{modelTable>ViewLabel}",
				visible: "{= ${modelTable>FlagGriglia} === 'BOLD' ? true : false}",
			}).addStyleClass("boldCss"));
			oVBox.addItem(new sap.m.Text({
				text: "{modelTable>ViewLabel}",
				visible: "{= ${modelTable>FlagGriglia} === '' ? true : false}"
			}));
			var j = 0;
			var aText = [];
			//aggiungo le covlonne
			for (var i = 0; i < 3; i++) {
				var sNumProperty = this.getView().byId("selectAnnicassa").getSelectedItem().getBindingContext("modelAnno").getProperty(
					"keyProperty") + j;
				if (sNumProperty.toString().length === 1) {
					var sJay = "00" + sNumProperty.toString();
				} else if (sNumProperty.toString().length === 2) {
					var sJay = "0" + sNumProperty.toString();
				} else if (sNumProperty.toString().length === 3) {
					var sJay = sNumProperty.toString();
				}
				aText.push(new sap.m.Text({
					text: "{" + "modelTable" + ">" + "ImportoCPAnno" + sJay.toString() + "}",
					textAlign: "Right",
					// editable: false
					// change: function(oEvent) {
					// 	that.onChangeNumberFormat(oEvent);
					// }
				}))

				j++;
				// }
			}
			var oTemplate = new sap.m.ColumnListItem({
				cells: [
					oVBox,
					aText[0],
					aText[1],
					aText[2],

				]
			});
			oTable.bindAggregation("items", { // Rilega nuovamente i dati alla tabella
				path: "modelTable>/",
				template: oTemplate // Sostituisci con il tuo template effettivo
			});
		},
		createPayloadVar: function(isTestata, valori, isCassa){
			var modelFilter = this.getView().getModel("modelFilter");
			let modelPosFin = this.getView().getModel("modelPosFin");
			let posFin = modelPosFin.getProperty("/PosFin");
			const esercizio = this.getView().getModel("globalModel").getProperty("/ANNO")

			var modelFilterData = modelFilter.getData()
			
			let payload = {
				"Fikrs" : "S001",
				"Anno" : esercizio,
				"Fase" : "NV",
				"Reale" : "R",
				"Versione" : posFin.Versione,
				"Fipex" : modelFilterData.posfin,
				"Fictr" : modelFilterData.struttAmm,
				"Fincodecoll" :!isCassa ? modelFilterData.autColl : "",
				"Fincode" : !isCassa ? modelFilterData.fincode : "SYSTSPESE",
				"Importo" : !valori.Importo ? "0" : valori.Importo,
				"CodiceStrumento" : modelFilterData.strumento,
				"CodiceStrumentoOri" : modelFilterData.strumentoOr,
				"CodiceSottostrumento" : modelFilterData.sStrumento,
				"AnnoDa" : !valori.AnnoDa ? "" : valori.AnnoDa,
				"AnnoA" : !valori.AnnoA ? "" : valori.AnnoA,
				"Capitolo" : posFin.Capitolo,
				"Eos" : modelFilterData.eos,
				"Residui":!valori.Residui ? "" : valori.Residui,
			}

			if(isTestata){
				payload.UPDATEDEEPVARIAZIONI = []
			}else{
				payload.Decorrere = !valori.Decorrere ? false : true
				payload.AllineaCassa = !valori.AllineaCassa ? false : true
				payload.Ricorrenza = !valori.Ricorrenza ? "" : valori.Ricorrenza
			}
			return payload
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
			const tabSelected = this.getView().byId("idIconTabBarMulti").getSelectedKey()
			const isCassa = tabSelected === "people" ? true : false

			if(!this.checkDecVsPluri(isCassa)){
				return
			}

			//return

			var oPayload = this.createPayloadBW(isCassa)

			//se rimodulazioni orizzontali controllo che la somma di tutti i valori diano 0 altrimenti do errore
			if(tabSelected === "RimOrizzontali"){
				const controlloSomma = this.checkSumEqualZero(oPayload)
				if(!controlloSomma) {
					MessageBox.warning('Attenzione. La rimodulazione non è compensativa.')
					return
				}
				const UPDATEDEEPRIMORI = oPayload.UPDATEDEEPVARIAZIONI
				delete oPayload.UPDATEDEEPVARIAZIONI
				oPayload['UPDATEDEEPRIMORI'] = UPDATEDEEPRIMORI				

			}	
			if(!oPayload){
				return
			}

			let msg = this.recuperaTestoI18n("confermaSalvataggio");

			if(!isCassa){

			const modelRow = !isCassa ? "modelTableSac" : "modelTableSacCa"
			var modelPluri = this.getView().getModel("modelPluri");
			var modelTSac = this.getView().getModel(modelRow);
			var modelTSacData = modelTSac.getData()
			var rowTriennio = modelTSacData[0]
				msg = !rowTriennio.FLAG_ALLINEA_CS ? this.recuperaTestoI18n("confermaSalvataggioCassaWarning") : this.recuperaTestoI18n("confermaSalvataggio");
			}


			//! LT -> mando i $ nell'oData per imputare i dati
			console.log(oPayload)
			MessageBox.show(msg, {
					icon: MessageBox.Icon.INFORMATION,
					title: "Salvataggio ",
					actions: [MessageBox.Action.YES, MessageBox.Action.NO],
					emphasizedAction: MessageBox.Action.YES,
					onClose:async function  (oAction) { 
						if(oAction === "YES"){
							const tabSelected = this.getView().byId("idIconTabBarMulti").getSelectedKey()
							//Salvataggio 
							//TODO Creare Payload
							//!lt controllo i tre anni e il modello pluri
							sap.ui.core.BusyIndicator.show();	
							var path = tabSelected !== "RimOrizzontali" ? "/Variazioni_ContabiliSet" : "/Rimodulazioni_orizzontaliSet"
							const invio  = await this.__setDataPromiseSaveBW( path ,oModelVarCont, {}, oPayload)		
							sap.ui.core.BusyIndicator.hide()
							if(invio.success) {
								MessageBox.success("Operazione eseguita con successo")
								//TODO reset modello pluri
								if(tabSelected === "attachments") this.showCompetenzaSAC(null,false,"NV");
								if(tabSelected === "Contabile") this.showDefRim();
								if(tabSelected === "people") this.showCassaSAC();
								if(tabSelected === "RimOrizzontali") this.showRimOrizzSAC(null,false,false,"NV");
							}
							else{
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

		checkSumEqualZero: function(payload){

			let somma = 0
			//TODO metodo per impostare valori per i pluriennali
			payload.UPDATEDEEPVARIAZIONI.forEach(row => {
				//se presente dal al devo fare le somme...
				if(row.AnnoA){
					//prendo gli anni dal al e faccio 
					let annoDa = parseInt(row.AnnoDa)
					let annoA = parseInt(row.AnnoA)
					let ricorrenza = parseInt(row.Ricorrenza) 
					if((annoDa - annoA) === 0) {
						somma = somma + parseInt(row.Importo)
					}else{
						//lt calcolo l'intervallo degli anni
							if(ricorrenza === 0) ricorrenza = 1
							//!lt creo per ogni anno dei pluriennali le righe
							for (let z = annoDa; z <= annoA; z = z + ricorrenza) {
								somma = somma + parseInt(row.Importo)
							}
					} 
				}else{
					somma = somma + parseInt(row.Importo)
				}
			});
			return somma === 0 ? true : false 
		},

		createPayloadBW: function(isCassa){

			const modelRow = !isCassa ? "modelTableSac" : "modelTableSacCa"

			var modelPluri = this.getView().getModel("modelPluri");
			var modelTSac = this.getView().getModel(modelRow);
			var modelTSacResidui = this.getView().getModel("modelTableSacCaVaRes");
			var modelFilter = this.getView().getModel("modelFilter");
			let modelPosFin = this.getView().getModel("modelPosFin");
			/* let posFin = modelPosFin.getProperty("/PosFin");
			const esercizio = this.getView().getModel("globalModel").getProperty("/ANNO")
			const tabSelected = this.getView().byId("idIconTabBarMulti").getSelectedKey()*/
			var modelPluriData = modelPluri.getData()
			var modelTSacData = modelTSac.getData()
			var modelTSacResiduiData = modelTSacResidui?.getData()
			var rowTriennio = modelTSacData[0]
			if(modelTSacResiduiData)
			var rowResidui = modelTSacResiduiData[0];
			var modelFilterData = modelFilter.getData()

			//! creo la testata
			var oPayload = this.createPayloadVar(true, {
				Decorrere : rowTriennio.FLAG_A_DECORRERE,
				AllineaCassa : rowTriennio.FLAG_ALLINEA_CS
			}, isCassa)
			
			//!lt check flag a decorrere... se il terzo valore è a 0,00 non posso mandare il flag a true
			let flagADecorrere = rowTriennio.FLAG_A_DECORRERE
			//if(rowTriennio.VAL_ANNO3 === "0,00" && flagADecorrere) flagADecorrere = false

			//lt come prima cosa recupero i valori del triennio			
				for (let i = 1; i <= 3; i++) {
					if(rowTriennio[`VAL_ANNO${i}`] === "0,00") continue
					//controllo che non sia = a 0 altrimenti non lo creo
					var valori = {
						Importo : rowTriennio[`VAL_ANNO${i}`].replace(",00","").replaceAll(".", ""),
						AnnoDa : rowTriennio[`ANNO${i}`].toString(),
						AnnoA : "",
						Decorrere : flagADecorrere,
						AllineaCassa : rowTriennio.FLAG_ALLINEA_CS
					}
					//if(parseFloat(valori.Competenza)  )

					var payload = this.createPayloadVar(false, valori, isCassa)
					oPayload.UPDATEDEEPVARIAZIONI.push(payload)				
				}

				if(rowResidui){
					if(rowResidui.VAL_ANNO1 !== "0,00"){
						var aDataRes = this.getView().getModel("modelRes").getData()[3] //prendo il totale
						var iNum = parseFloat(aDataRes.ImportoCSAnno001.replaceAll(",","."))
						var iRes = parseFloat(rowResidui.VAL_ANNO1.split(",")[0].replaceAll(".",""))
						if(iNum + iRes < 0){
							return MessageBox.error("Operazione non consentita!. L'operazione dei residui rende negativo il Totale Previsioni DLB Integrato (Sez. I + Sez. II)");	
						}
						var valori = {
							Importo : rowResidui.VAL_ANNO1.replace(",00","").replaceAll(".", ""),
							AnnoDa : rowResidui.ANNO1.toString(),
							AnnoA : "",
							Decorrere : flagADecorrere,
							AllineaCassa : rowResidui.FLAG_ALLINEA_CS,
							Residui:"X"
						}
						var payload = this.createPayloadVar(false, valori, isCassa);
						oPayload.UPDATEDEEPVARIAZIONI.push(payload);
					} 
				}
				//! lt gestisto la popup dei plurienni
				if(modelPluriData){

					if(modelPluriData.annoSing){
						var singoloRecord = {
							Importo : el.importo.replace(",00","").replaceAll(".", ""),
							AnnoDa : el.annoDal,
							Decorrere : flagADecorrere,
							AllineaCassa : rowTriennio.FLAG_ALLINEA_CS
						}
						oPayload.UPDATEDEEPVARIAZIONI.push(this.createPayloadVar(false, singoloRecord, isCassa))
					}
					//creo il singolo anno dei pluriennali
					if(modelPluriData &&  modelPluriData.NAV_PLUR && modelPluriData.NAV_PLUR.length > 0){
						//lt trovo tutti i record con un anno dal al valorizzato
						let recordDaInviare = modelPluriData.NAV_PLUR.filter(row => row.annoDal !== "" && row.annoAl !== "")
						recordDaInviare.forEach(el => {
							var recordPluri = {
								Importo : el.importo.replace(",00","").replaceAll(".", ""),
								AnnoDa : el.annoDal,
								AnnoA : el.annoAl,
								Ricorrenza : el.ricorrenza,
								Decorrere : flagADecorrere,
								AllineaCassa : rowTriennio.FLAG_ALLINEA_CS
							}
							oPayload.UPDATEDEEPVARIAZIONI.push(this.createPayloadVar(false, recordPluri, isCassa))
						});
					}					
				}

				if(oPayload.UPDATEDEEPVARIAZIONI.length === 0){
					MessageBox.warning("Non ci sono valori da imputare")
					return false
				}
				return oPayload
		},

		

		createModelAnnoSelect: function() {
			var intEsercizio = new Date().getFullYear() + 1;
			var aAnni = [];
			var sAnnoFirst = intEsercizio;
			var keyproperty = 1;
			for (var i = 0; i < 34; i++) {
				var anno1 = sAnnoFirst + i;
				var anno2 = sAnnoFirst + 1 + i;
				var anno3 = sAnnoFirst + i + 2;
				var oObject = {
					keyProperty: keyproperty,
					keyAnno: sAnnoFirst + i,
					textAnno: anno1.toString() + " - " + anno2.toString() + " - " + anno3.toString()
				}
				sAnnoFirst = sAnnoFirst + 2;
				keyproperty = keyproperty + 3;
				aAnni.push(oObject);
			}
			this.getView().setModel(new JSONModel(aAnni), "modelAnno");
		},

		setModelSelect: function() {
			var oOject = {
				keyAnno: this.getView().getModel("modelAnno").getData()[0].keyAnno,
				ANNO1: this.getView().getModel("modelAnno").getData()[0].keyAnno,
				ANNO2: parseInt(this.getView().getModel("modelAnno").getData()[0].keyAnno) + 1,
				ANNO3: parseInt(this.getView().getModel("modelAnno").getData()[0].keyAnno) + 2
			};
			this.getView().setModel(new JSONModel(oOject), "modelAnnoTriennio");
		},

		_navigateSac: function(sUrl, sCase) {
			var that = this;
			if (sCase === "Comp") {
				var oFrame = this.getView().byId("competenzaSac");
			}

			var oFrameContent = oFrame.$()[0];
			if (oFrame.$()[0].src.lenght !== 0) {
				oFrameContent.setAttribute("src", "");
			}
			oFrameContent.setAttribute("src", sUrl);
			// this._refresh();
		},

		/* splitTable: function(aData, sSac, sModel) {
			return aData
			//! da verificare view position
			var aDataModel = [],
				aDataModelRes = []
			for (var i = 0; i < aData.length; i++) {
				if (aData[i].ViewPosition >= "101") { //escludiamo i residui
					aDataModel = aData.splice(0, i)
					aDataModelRes = aData
				}
			}
			return aDataModel;
		}, */

		onPressSearch: async function() {
			this._openBusyDialog();

			this.popolateModelFilter();
			var aResult_Comp = await this.onPressAvvioComp();
			var aResult_Comp = this.splitTable(aResult_Comp, "COMP", "modelTable");
			await this.setAnnoDalAl();
			var sPrefix;
			var modelFilter = this.getView().getModel("modelFilter").getData();
			this.getView().setModel(new JSONModel(aResult_Comp), "modelTable");
			this.getView().byId("tableSac").setVisible(true);
			this.setModelSelect();
			this.setModelTableSac(null,false);
			this.setModelTableResidui();

			this.getView().setModel(new JSONModel([]), "modelAppoggio");
			this.closeBusyDialog();
		},

		onSaveImportiCP: function() {
			var sSelectedImports = this.getView().getModel("modelTableSac").getData()[0];
			var sModelAppoggio = this.getView().getModel("modelAppoggio").getData();
			var j = 1;
			if (sModelAppoggio.length > 0) {
				for (var i = 0; i < 3; i++) {
					for (var a = 0; a < sModelAppoggio.length; a++) {
						if (sSelectedImports["ANNO" + j] === sModelAppoggio[a].ANNO) {
							sModelAppoggio[a].IMPORTO = sSelectedImports["VAL_ANNO" + j];
							var sDuplicate = true;
							break;
						} else {
							var sDuplicate = false;
						}
					}
					if (sDuplicate === false) {
						if (sSelectedImports["VAL_ANNO" + j] !== "") {
							var oObject = {
								IMPORTO: sSelectedImports["VAL_ANNO" + j],
								ANNO: sSelectedImports["ANNO" + j],
							};
							sModelAppoggio.push(oObject);
						}
					}
					j++;
				}
			} else {
				for (var i = 0; i < 3; i++) {
					if (sSelectedImports["VAL_ANNO" + j] !== "") {
						var oObject = {
							IMPORTO: sSelectedImports["VAL_ANNO" + j],
							ANNO: sSelectedImports["ANNO" + j],
						};
						sModelAppoggio.push(oObject);
					}
					j++;
				}
			}
		},

		setModelTableSac: function(oEvent, cassa, isForExport) {
			const exp = isForExport === true ? "Exp" : ""
			var isCassa = !cassa ? "" : cassa
			var labelTabella = !cassa ? "Competenza" : "Cassa"
			var sModelAppoggio = this.getView().getModel("modelAppoggio").getData();
			//var sAnnoSelect = parseInt(this.getView().byId("selectAnnicassa").getSelectedKey());
			var sAnnoSelect = parseInt(this.getView().getModel("modelAnno").getData()[0].keyAnno);
			var sAnno2 = sAnnoSelect + 1;
			var sAnno3 = sAnnoSelect + 2;
			var aResultTabSac = [{
				LABEL: `Variazioni di ${labelTabella}:`,
				VAL_ANNO1: "0,00",
				VAL_ANNO2: "0,00",
				VAL_ANNO3: "0,00",
				ANNO1: sAnnoSelect,
				ANNO2: sAnno2,
				ANNO3: sAnno3,
				ANNO_FASE: "2024",
				EOS: "S",
				FLAG_A_DECORRERE: false,
				FLAG_ALLINEA_CS: false,
				AREA_FIN: "S001",
				FASE: "NV"
			}];
			if (sModelAppoggio.length > 0) {
				for (var i = 0; i < sModelAppoggio.length; i++) {
					if (sAnnoSelect === sModelAppoggio[i].ANNO) {
						aResultTabSac[0].VAL_ANNO1 = sModelAppoggio[i].IMPORTO;
					} else if (sAnno2 === sModelAppoggio[i].ANNO) {
						aResultTabSac[0].VAL_ANNO2 = sModelAppoggio[i].IMPORTO;
					} else if (sAnno3 === sModelAppoggio[i].ANNO) {
						aResultTabSac[0].VAL_ANNO3 = sModelAppoggio[i].IMPORTO;
					}
				}
			}
			this.getView().setModel(new JSONModel(aResultTabSac), "modelTableSac" + isCassa + exp);
			this.getView().setModel(new JSONModel({
				ANNO1: sAnnoSelect.toString(),
				ANNO2: sAnno2.toString(),
				ANNO3: sAnno3.toString(),
			}), "mdColumnVariazioni" + isCassa + exp);
		},

		setModelTableResidui: function(){
			// const exp = isForExport === true ? "Exp" : ""
			// var isCassa = !cassa ? "" : cassa
			// var sModelAppoggio = this.getView().getModel("modelAppoggio").getData();
			//var sAnnoSelect = parseInt(this.getView().byId("selectAnnicassa").getSelectedKey());
			var sAnnoSelect = parseInt(this.getView().getModel("modelAnno").getData()[0].keyAnno);
			var sAnno2 = sAnnoSelect + 1;
			var sAnno3 = sAnnoSelect + 2;
			var aResultTabSac = [{
				LABEL: `Variazioni Residui:`,
				VAL_ANNO1: "0,00",
				// VAL_ANNO2: "0,00",
				// VAL_ANNO3: "0,00",
				ANNO1: sAnnoSelect,
				ANNO2: sAnno2,
				ANNO3: sAnno3,
				ANNO_FASE: "2024",
				EOS: "S",
				FLAG_A_DECORRERE: false,
				FLAG_ALLINEA_CS: false,
				AREA_FIN: "S001",
				FASE: "NV"
			}];

			this.getView().setModel(new JSONModel(aResultTabSac), "modelTableSacCaVaRes" 
				// + isCassa + exp
			);
			this.getView().setModel(new JSONModel({
				ANNO1: sAnnoSelect.toString(),
				// ANNO2: sAnno2.toString(),
				// ANNO3: sAnno3.toString(),
			}), "mdColumnVariazioniResidui"
			//  + isCassa + exp
			);
		},

		onDeleteValue: function(oEvent) {
			
			const modelTable = this.getView().getModel("modelTableRes3");
			let modelData =  modelTable.getData()

			if(modelData.length === 4){

				modelData[3].ImportoAnno1 = "0.00"
				modelData[3].ImportoAnno2 = "0.00"
				modelData[3].ImportoAnno3 = "0.00"

				modelTable.setProperty("/3", modelData[3])
				this.getView().setModel(new JSONModel({AllineaCassa : false}), "modelPayload")
			}			

			this.getView().setModel(new JSONModel({
                visImporti: "true",
				annoSing: "",
				selectSing: false,
				selectPluri: true,
				importo: "0,00",
				NAV_PLUR: [{
					annoDal: "",
					annoAl: "",
					ricorrenza: "1",
					importo: "0,00"
				}]
			}), "modelPluri");

		},

		onDeleteValueRimodulazioniOri: function(oEvent) {
			
			// const modelTableCassa = this.getView().getModel("modelTableSacCa");
			// const modelTableVarResidui = this.getView().getModel("modelTableSacCaVaRes");
			this.setModelTableSac(null,"");
			this.setModelTableResidui();
			this.getView().setModel(new JSONModel({
                visImporti: "true",
				annoSing: "",
				selectSing: false,
				selectPluri: true,
				importo: "0,00",
				NAV_PLUR: [{
					annoDal: "",
					annoAl: "",
					ricorrenza: "1",
					importo: "0,00"
				}]
			}), "modelPluri");		

		},
		onDeleteValueRif: function(oEvent) {
			
			// const modelTableCassa = this.getView().getModel("modelTableSacCa");
			// const modelTableVarResidui = this.getView().getModel("modelTableSacCaVaRes");
			this.setModelTableSac(null,"");
			this.setModelTableResidui();
			this.getView().setModel(new JSONModel({
                visImporti: "true",
				annoSing: "",
				selectSing: false,
				selectPluri: true,
				importo: "0,00",
				NAV_PLUR: [{
					annoDal: "",
					annoAl: "",
					ricorrenza: "1",
					importo: "0,00"
				}]
			}), "modelPluri");		

		},
		onDeleteValueComp: function(oEvent) {
			
			// const modelTableCassa = this.getView().getModel("modelTableSacCa");
			// const modelTableVarResidui = this.getView().getModel("modelTableSacCaVaRes");
			this.setModelTableSac(null,"");
			this.setModelTableResidui();
			this.getView().setModel(new JSONModel({
                visImporti: "true",
				annoSing: "",
				selectSing: false,
				selectPluri: true,
				importo: "0,00",
				NAV_PLUR: [{
					annoDal: "",
					annoAl: "",
					ricorrenza: "1",
					importo: "0,00"
				}]
			}), "modelPluri");		

		},

		onDeleteValueCassa: function(oEvent) {
			
			// const modelTableCassa = this.getView().getModel("modelTableSacCa");
			// const modelTableVarResidui = this.getView().getModel("modelTableSacCaVaRes");
			this.setModelTableSac(null,"Ca");
			this.setModelTableResidui();
			this.getView().setModel(new JSONModel({
                visImporti: "true",
				annoSing: "",
				selectSing: false,
				selectPluri: true,
				importo: "0,00",
				NAV_PLUR: [{
					annoDal: "",
					annoAl: "",
					ricorrenza: "1",
					importo: "0,00"
				}]
			}), "modelPluri");		

		},

		onPressAvvioComp: async function(sFase) {
			this.getView().setModel(new JSONModel([]), "modelAppoggio");
			var modelFilter = this.getView().getModel("modelFilter").getData();
			var sEntity, sEos = modelFilter.eos;
			sEntity =
				`QuadroContabile(P_Disp=true,P_AreaFin='S001',P_AnnoFase='${modelFilter.keyAnno}',P_AnnoMin='${modelFilter.keyAnno}',P_AnnoMax='${modelFilter.keyAnno + 2}',P_Fase='${sFase}',P_Eos='S',P_PosFin='${modelFilter.posfin}',P_Autorizz='${modelFilter.fincode}',P_Capitolo='${modelFilter.codCap}',P_RecordType='CB')/Set`;

			var aFilter = [];

			try {
				var aResult = await this.readFromDb("3", "/" + sEntity, [], [], "", "");
			} catch (e) {
				// var message = e.message + " per competenza";
				// MessageBox.warning(message);
				aResult = [];
			}
			return aResult;
		},

		onPressAvvioCassa: async function() {
			this._openBusyDialog();
			var modelFilter = this.getView().getModel("modelFilter").getData();
			var sEntity, sEos = modelFilter.eos;
			sEntity = sEos === "S" ? "ZES_QC_S_SET" : "ZES_QC_E_SET";
			// var sAnno1 = parseInt(this.getView().byId("selectAnnicassa").getSelectedKey());
			var sAnno1 = this.getView().getModel("modelAnno").getData()[0].keyAnno;
			var sAnno2 = sAnno1 + 1;
			var sAnno3 = sAnno2 + 1;
			var aFilter = [];
			// aFilter.push(new Filter("AUTORIZZAZIONE", FilterOperator.EQ, modelFilter.fincode));
			aFilter.push(new Filter("POS_FIN", FilterOperator.EQ, modelFilter.posfin.replaceAll(".", "")));
			aFilter.push(new Filter("FLAG_CASSA", FilterOperator.EQ, "X"));
			aFilter.push(new Filter("ANNO_MOV", FilterOperator.BT, "2024", "2026"));
			try {
				var aResult = await this.readFromDb("0", "/" + sEntity, aFilter, [], "", "");
			} catch (e) {
				aResult = [];
				// var message = e.message + " per cassa";
				// MessageBox.warning(message);
			}

			this.getView().setModel(new JSONModel(aResult), "modelTableCassa");
			this.closeBusyDialog();
		},

		onSelectTriennio: function() {
			var sTable = this.getView().byId("idTableyear").getColumns();
			for (var i = 0; i < sTable.length; i++) {
				if (sTable[i].getHeader().getText() !== "") {
					this.getView().byId("idTableyear").getColumns()[1].destroy();
				}
			}
			this.deleteCells("idColumnListItemsYear");
			this.functionTemp("idTableyear", "idColumnListItemsYear", "modelTable", "ImportoCPAnno", "Competenza");
			this.onSaveImportiCP();
			this.setModelTableSac(null,false);
			this.setModelTableResidui();

			// this.getView().setModel(new JSONModel([]), "modelTable");
			// this.onPressSearch();
			// this.functionTemp("idTableyear", "idColumnListItemsYear", "modelTableYear", "cassa", "Cassa");
		},

		setAnnoDalAl: async function() {
			var aFilter = [];
			var modelFilter = this.getView().getModel("modelFilter").getData();
			var sEntity, sEos = modelFilter.eos;
			sEntity =
				"ZCOBI_I_QC_DAL_AL(P_AnnoFase='2024',P_AnnoStr='2024',P_AnnoSstr='2026',P_PosFin='" +
				modelFilter.posfin + "',P_Autorizz='" + modelFilter.fincode +
				"',P_StruttAmm='" + modelFilter.struttAmm + "')/Set";
			try {
				aFilter.push(new Filter("RecordType", FilterOperator.EQ, "CP"));
				var aResult = await this.readFromDb("2", "/" + sEntity, aFilter, [], "", "");
				aResult = aResult.sort(
					(a, b) => parseInt(a.YearLow) - parseInt(b.YearLow)
				);
			} catch (e) {
				var message = e.message + " per Dal - Al";
				MessageBox.warning(message);
				aResult = [];
			}

			this.getView().setModel(new JSONModel(aResult), "modelTableComp");
		},

		onPressSalvaFiori: async function() {
			this._openBusyDialog();
			var sModelTableSac = this.getView().getModel("modelTableSac").getData()[0];
			var modelFilter = this.getView().getModel("modelFilter").getData();
			// var sEntity = "/ZES_VAR_COMP_ANNI_SET(POS_FIN='" + modelFilter.posfin + "',AUTORIZZAZIONE='" + modelFilter.fincode +
			// 	"',ANNO_FASE='" +
			// 	sModelTableSac.ANNO_FASE +
			// 	"',EOS='" +
			// 	sModelTableSac.EOS +
			// 	"',PRCTR='" + modelFilter.prctr + "',STRUMENTO='" + modelFilter.strumento + "',SOTTOSTRUMENTO='" + modelFilter.sStrumento +
			// 	"',STRUMENTO_ORI='" +
			// 	modelFilter.strumentoOr +
			// 	"',ST_AMM='" + modelFilter.struttAmm + "',AREA_FIN='" + sModelTableSac.AREA_FIN + "',FASE='" + sModelTableSac.FASE + "')";
			// var oObject = {
			// 	ANNO1: sModelTableSac.ANNO1,
			// 	ANNO2: sModelTableSac.ANNO2,
			// 	ANNO3: sModelTableSac.ANNO3,
			// 	VAL_ANNO1: sModelTableSac.VAL_ANNO1,
			// 	VAL_ANNO2: sModelTableSac.VAL_ANNO2,
			// 	VAL_ANNO3: sModelTableSac.VAL_ANNO3,
			// 	FLAG_ALLINEA_CS: sModelTableSac.FLAG_ALLINEA_CS,
			// 	FLAG_A_DECORRERE: sModelTableSac.FLAG_A_DECORRERE
			// };
			var sEntity = "/ZES_VAR_COMP_ANNI_SET";

			var aSave = this.formattForSave();
			var objDeep = {
				POS_FIN: modelFilter.posfin,
				AUTORIZZAZIONE: modelFilter.fincode,
				ANNO_FASE: sModelTableSac.ANNO_FASE,
				EOS: sModelTableSac.EOS,
				VERS_C: "P",
				VERS_A: "C",
				REALE: "R",
				REALE_C: "R",
				AUT_COLLEGATA: modelFilter.autColl,
				AUDIT_TRAIL: "INPUT_BIL",
				PRCTR: modelFilter.prctr,
				CODICE_CDR: modelFilter.codCdr,
				STRUMENTO: modelFilter.strumento,
				SOTTOSTRUMENTO: modelFilter.sStrumento,
				STRUMENTO_ORI: modelFilter.strumentoOr,
				ST_AMM: modelFilter.struttAmm,
				AREA_FIN: sModelTableSac.AREA_FIN,
				FASE: sModelTableSac.FASE,
				FLAG_ALLINEA_CS: sModelTableSac.FLAG_ALLINEA_CS === false ? "" : "X",
				FLAG_A_DECORRERE: sModelTableSac.FLAG_A_DECORRERE === false ? "" : "X",
				NAV_VAR_TO_ANNI: aSave
			}
			try {
				var aResult = await this.insertRecord("0", sEntity, objDeep);
				this.closeBusyDialog();
				await this.onPressSearch();
				if (aResult.TYPE === "") {
					MessageBox.success("Modifica avventua con successo");
				} else {
					MessageBox.error(aResult.MESSAGE);
				}
			} catch (e) {
				this.closeBusyDialog();
				MessageBox.error(e.message);
			}

		},

		formattForSave: function() {
			var modelFilter = this.getView().getModel("modelFilter").getData();
			var sAnno = modelFilter.keyAnno;
			var oObject = [];
			if (this.getView().getModel("modelAppoggio").getData().length > 0) {
				var sModelAppoggio = this.getView().getModel("modelAppoggio").getData();
				var sModelTableSac = this.getView().getModel("modelTableSac").getData()[0];
				var sEsiste1 = false;
				var sEsiste2 = false;
				var sEsiste3 = false;
				for (var i = 0; i < sModelAppoggio.length; i++) {
					if (sModelTableSac.ANNO1 === sModelAppoggio[i].ANNO) {
						sModelAppoggio[i].IMPORTO = sModelTableSac.VAL_ANNO1;
						sEsiste1 = true;
					} else if (sModelTableSac.ANNO2 === sModelAppoggio[i].ANNO) {
						sModelAppoggio[i].IMPORTO = sModelTableSac.VAL_ANNO2;
						sEsiste2 = true;
					} else if (sModelTableSac.ANNO3 === sModelAppoggio[i].ANNO) {
						sModelAppoggio[i].IMPORTO = sModelTableSac.VAL_ANNO3;
						sEsiste3 = true;
					}
				}
				if (sEsiste1 === false) {
					if (sModelTableSac.VAL_ANNO1 !== "") {
						var oObject = {
							IMPORTO: sModelTableSac.VAL_ANNO1,
							ANNO: sModelTableSac.ANNO1
						};
						sModelAppoggio.push(oObject);
					}
				}
				if (sEsiste2 === false) {
					if (sModelTableSac.VAL_ANNO2 !== "") {
						var oObject = {
							IMPORTO: sModelTableSac.VAL_ANNO2,
							ANNO: sModelTableSac.ANNO2
						};
						sModelAppoggio.push(oObject);
					}
				}
				if (sEsiste3 === false) {
					if (sModelTableSac.VAL_ANNO3 !== "") {
						var oObject = {
							IMPORTO: sModelTableSac.VAL_ANNO3,
							ANNO: sModelTableSac.ANNO3
						};
						sModelAppoggio.push(oObject);
					}
				}
				sModelAppoggio.forEach(function(single) {
					single.IMPORTO = single.IMPORTO.replaceAll(".", "").replaceAll(",", ".");
					single.ANNO = single.ANNO.toString();
				});

				var oObjectForSave = sModelAppoggio;
			} else {
				var sModelTableSac = this.getView().getModel("modelTableSac").getData()[0];
				oObject = this.returnDeepSave(sModelTableSac.VAL_ANNO1, parseInt(sAnno), oObject);
				oObject = this.returnDeepSave(sModelTableSac.VAL_ANNO2, parseInt(sAnno) + 1, oObject);
				oObject = this.returnDeepSave(sModelTableSac.VAL_ANNO3, parseInt(sAnno) + 2, oObject);
				return oObject;
			}
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

		returnDeepSave: function(impo, anno, obj) {
			var oObject = {
				IMPORTO: impo.replaceAll(".", "").replaceAll(",", "."),
				ANNO: anno.toString()
			};
			obj.push(oObject);
			return obj;
		},

		insertRecord: function(sDbSource, sEntitySet, oRecord) {
			var aReturn = this._getDbOperationReturn();
			var oModel = this._getDbModel(sDbSource);
			return new Promise(function(resolve, reject) {
				oModel.create(sEntitySet, oRecord, {
					success: function(oData) {
						if (sEntitySet === "/Dass_HeaderSet" || sEntitySet === "/ZES_UCB_CHECK_SET") {
							return resolve(oData);
						} else {
							return resolve(oData);
						}
					},
					error: function(e) {
						/* if (oData.Belnr) {
							return oData.Belnr;
						} else { */
						aReturn.returnStatus = false;
						try {
							aReturn.message = JSON.parse(e.responseText).error.message.value;
						} catch (e) {
							try {
								aReturn.message = JSON.parse(e.responseText);
							} catch (e) {
								aReturn.message = e.responseText;
							}
						}
						return reject(aReturn);
						/* } */
					}
				});
			});
		},

		//Edit a record on the DB in the cloud Odata V2
		modifyRecord: function(sDbSource, sEntitySet, oRecord) {
			var aReturn = this._getDbOperationReturn();
			var oModel = this._getDbModel(sDbSource);
			// Leggo il modello da SAP
			return new Promise(function(resolve, reject) {
				oModel.update(sEntitySet, oRecord, {
					success: function(oData) {
						aReturn.returnStatus = true;
						return resolve(aReturn.returnStatus);
					},
					error: function(e) {
						aReturn.returnStatus = false;
						return reject(aReturn.returnStatus);
					}
				});
			});
		},

		readFromDb: function(sDbSource, sEntitySet, aFilters, aSorters, sExpand, orderBy) {
			var aReturn = this._getDbOperationReturn();
			var oModel = this._getDbModel(sDbSource);
			var sUrlParamtersExpand = {};
			if ((sExpand !== "" && sExpand !== undefined) && (orderBy !== "" && orderBy !== undefined)) {
				sUrlParamtersExpand = {
					"$expand": sExpand,
					"$orderby": orderBy
				};
			} else if ((sExpand !== "" && sExpand !== undefined)) {
				sUrlParamtersExpand = {
					"$expand": sExpand
				};
			} else if ((orderBy !== "" && orderBy !== undefined)) {
				sUrlParamtersExpand = {
					"$orderby": orderBy
				};
			}
			return new Promise(function(resolve, reject) {
				oModel.read(sEntitySet, {
					filters: aFilters,
					sorters: aSorters,
					urlParameters: sUrlParamtersExpand,
					success: function(oData) {
						aReturn.returnStatus = true;
						if (oData.results === undefined) {
							aReturn.data = oData;
						} else {
							aReturn.data = oData.results;
						}

						resolve(aReturn.data);
						// return resolve(aReturn.data);
					},
					error: function(e) {
						aReturn.returnStatus = false;
						if (e.statusCode !== 500) {
							aReturn.codeError = JSON.parse(e.responseText).error.code;
							aReturn.message = JSON.parse(e.responseText).error.message.value;
						}

						return reject(aReturn);
						// return reject(e);
					}
				});
			});
		},

		_getDbOperationReturn: function() {
			return {
				returnStatus: false,
				data: []
			};
		},

		_getDbModel: function(sCase) {
			switch (sCase) {
				case "0":
					return this.getOwnerComponent().getModel("ZSS4_COBI_QC_SRV");
				case "1":
					return this.getOwnerComponent().getModel("ZSS4_URL_DINAMICO_SRV");
				case "2":
					return this.getOwnerComponent().getModel("ZSS4_COBI_QUADRO_CONTABILE_SRV");
				case "3":
					return this.getOwnerComponent().getModel("ZSS4_COBI_QUADRO_CONTABILE_SRV");
				case "4":
					return this.getOwnerComponent().getModel("sapHanaS2FoglioNotizie");

			}
		},
		openFragmentSac: function() {
			this._oFragmenYear = sap.ui.xmlfragment(
				"zsap.com.r3.cobi.s4.gestposfinnv.view.ProvaSac", this);
			this.getView().addDependent(this._oFragmenYear);

			this._oFragmenYear.open();

		},
		onPressChiudi: function() {
			this._oFragmenYear.exit();
			this._oFragmenYear.destroy();
			if (this.getView().byId("idIconTabBarMulti").getSelectedKey() === "cassa") {
				this.onPressAvvioCassa();
			} else {
				this.onPressAvvioComp();
			}
		},

		openquadroCont: async function (sValue, oEvent, sPF, sCP, sCB,isForExport,bCompOnly,sFase) {
			const exp = isForExport === true ? "Exp" : ""
			this.getView().setBusy(true);
			this.getView().setModel(new JSONModel([{}]), `modelTableQuadro${exp}`);
			let oModelQuadro = this.getOwnerComponent().getModel("ZSS4_COBI_QUADRO_CONTABILE_DLB_SRV")
			if(sFase === "NV"){
				oModelQuadro = this.getOwnerComponent().getModel("ZSS4_COBI_QUADRO_CONTABILE_SRV")
			}
			let oModelPosFin = this.getView().getModel("modelPosFin");
			let sAnno = this.getOwnerComponent().getModel("globalModel").getData().ANNO;
			let oAut = oModelPosFin.getProperty("/CompetenzaAuth");
			var aDataREs = oModelPosFin.getProperty("/detailAnagrafica");
			if (sValue === "CAP") {
				var sEntity = "/QuadroContabile(P_Disp=true,P_AreaFin='S001',P_AnnoFase='" + sAnno + "',P_AnnoMin='" + sAnno + "',P_AnnoMax='" + (parseInt(sAnno) + 2) + "',P_Fase='"+sFase+"',P_Eos='S',P_PosFin='" + oModelPosFin.getProperty("/PosFin/Fipex") + "',P_Autorizz='',P_Capitolo='" + oModelPosFin.getProperty("/PosFin/Capitolo") + "',P_RecordType='OC')/Set" 
				var sTitle = "Quadro Contabile Capitolo " + aDataREs.AMMINISTAZIONE + " " + aDataREs.CAPITOLO;
			} else if (sValue === "PF") {
				var sEntity = "/QuadroContabile(P_Disp=true,P_AreaFin='S001',P_AnnoFase='" + sAnno + "',P_AnnoMin='" + sAnno + "',P_AnnoMax='" + (parseInt(sAnno) + 2) + "',P_Fase='"+sFase+"',P_Eos='S',P_PosFin='" + oModelPosFin.getProperty("/PosFin/Fipex") + "',P_Autorizz='',P_Capitolo='" + oModelPosFin.getProperty("/PosFin/Capitolo") + "',P_RecordType='OP')/Set"
				var sTitle = "Quadro Contabile Posizione Finanziaria " + oModelPosFin.getProperty("/detailAnagrafica").AMMINISTAZIONE + " " +oModelPosFin.getProperty("/detailAnagrafica").CAPITOLO+"."+oModelPosFin.getProperty("/detailAnagrafica").pg;
			} else {
				var sEntity = "/QuadroContabile(P_Disp=true,P_AreaFin='S001',P_AnnoFase='" + sAnno + "',P_AnnoMin='" + sAnno + "',P_AnnoMax='" + (parseInt(sAnno) + 2) + "',P_Fase='"+sFase+"',P_Eos='S',P_PosFin='" + oModelPosFin.getProperty("/PosFin/Fipex") + "',P_Autorizz='" + oAut.Auth.IdAutorizzazione + "',P_Capitolo='" + oModelPosFin.getProperty("/PosFin/Capitolo") + "',P_RecordType='CB')/Set"
				var sTitle = "Quadro Contabile del Coding Block  " + oModelPosFin.getProperty("/detailAnagrafica").AMMINISTAZIONE + " " +oModelPosFin.getProperty("/detailAnagrafica").CAPITOLO+"."+oModelPosFin.getProperty("/detailAnagrafica").pg + " " + oModelPosFin.getProperty("/CompetenzaAuth").DescrInputAuth;
			}
			
			if(sValue ==="PF" || sValue==="CAP"){
				this.getView().setModel(new JSONModel({FlagCassa:"X"}), "modelCheckCassa");
			}else{
				this.getView().setModel(new JSONModel({FlagCassa:""}), "modelCheckCassa");
			}

			this.timeCreate = undefined;
			if(bCompOnly){
				if (!this.oDialogQuadroComp) {
					this.oDialogQuadroComp = sap.ui.xmlfragment(
						"zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.QuadroContabileComp",
						this
					);
					this.getView().addDependent(this.oDialogQuadroComp);
					this.timeCreate = "yes"
				}
				this.oDialogQuadroComp.openBy(oEvent.getSource());
			}
			else{
				if (!this.oDialogQuadro) {
					this.oDialogQuadro = sap.ui.xmlfragment(
						"zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.QuadroContabile",
						this
					);
					this.getView().addDependent(this.oDialogQuadro);
					this.timeCreate = "yes"
				}
				this.oDialogQuadro.openBy(oEvent.getSource());
			}
			
			
			this.getView().setBusy(false);

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

			if (this.timeCreate) {
				//this.functionTemp("idTableyearQuadro", "idColumnListItemsYearQuadro", "modelTableQuadro", "ImportoCPAnno", "Competenza", this.timeCreate);
				//this.functionTemp("idTableyearQuadro", "idColumnListItemsYearQuadro", "modelTableQuadro", "ImportoCSAnno", "Cassa", this.timeCreate);
			}
			
			if(bCompOnly){
				this.oDialogQuadroComp.setBusy(true);
			}else{
				this.oDialogQuadro.setBusy(true);
			}
			var aRes = await this.__getDataPromise(sEntity, [], oModelQuadro);
			this.formatterImporti(aRes, true)
			this.splitTable(aRes, "COMP", `modelTableQuadro`, isForExport );
			let dalAlCs = true
			//! LT dal al quadro contabile capitolo
			if(sValue === 'CAP' && exp === ""){
				let entityDalAl = `/ZCOBI_I_CAP_DAL_AL(P_AnnoFase='${sAnno}',P_Fase='${sFase}',P_Capitolo='${oModelPosFin.getProperty("/PosFin/Capitolo")}',P_Eos='S',P_Ammin='${oModelPosFin.getProperty("/strutturaAmminCentrale/Prctr").substr(1)}')/Set`
				if(sFase === "NV")
					entityDalAl = `/ZCOBI_I_CAP_DAL_AL_NV(P_AnnoFase='${sAnno}',P_Fase='${sFase}',P_Capitolo='${oModelPosFin.getProperty("/PosFin/Capitolo")}',P_Eos='S',P_Ammin='${oModelPosFin.getProperty("/strutturaAmminCentrale/Prctr").substr(1)}')/Set`
				var aReqDalAl = await this.__getDataPromise(entityDalAl, [], oModelQuadro);
				this.formatterImporti(aReqDalAl, false, "Importo")
				aReqDalAl = aReqDalAl.sort(
					(a, b) => parseInt(a.YearLow) - parseInt(b.YearLow)
				);

				let quadroDal = aReqDalAl.filter(el => el.RecordType === 'CP')
				let quadroDalcs = aReqDalAl.filter(el => el.RecordType === 'CS')

				this.getView().setModel(new JSONModel(quadroDal), `modelTableQuadroDal`);
				this.getView().setModel(new JSONModel(quadroDalcs), `modelTableQuadroDalCs`);
		}else if(sValue === 'PF' && exp === ""){

			const sstr = oModelPosFin.getProperty("/infoSottoStrumento")
      let sEntityCp = `/ZCOBI_I_PF_DAL_AL_DLB(P_AnnoFase='${sAnno}',P_AnnoStr='${sAnno}',P_AnnoSstr='${(parseInt(sAnno) + 2)}',P_PosFin='${oModelPosFin.getProperty("/PosFin/Fipex")}',P_StruttAmm='${oModelPosFin.getProperty("/strutturaAmminCentrale").Fictr}')/Set?sap-client=100`
      //let sEntityCp = `/ZCOBI_I_SSTRPF_DAL_AL(P_AnnoFase='${sAnno}',P_Fase='NV',P_Sstr='${sstr.CodiceSottostrumento}',P_Str='${sstr.CodiceStrumento}',P_Str_ori='${sstr.CodiceStrumentoOri}',P_StruttAmm='${oModelPosFin.getProperty("/strutturaAmminCentrale").Fictr}',P_PosFin='${oModelPosFin.getProperty("/PosFin/Fipex")}')/Set?`
      let sEntityCs = `/ZCOBI_I_QC_DAL_AL_DLB(P_AnnoFase='${sAnno}',P_AnnoStr='${sAnno}',P_AnnoSstr='${(parseInt(sAnno) + 2)}',P_PosFin='${oModelPosFin.getProperty("/PosFin/Fipex")}',P_Autorizz='',P_StruttAmm='${oModelPosFin.getProperty("/strutturaAmminCentrale").Fictr}')/Set?sap-client=100`
      //let sEntityCs = `/ZCOBI_I_SSTR_DAL_AL(P_AnnoFase='${sAnno}',P_Fase='NV',P_Sstr='${sstr.CodiceSottostrumento}',P_Str='${sstr.CodiceStrumento}',P_Str_ori='${sstr.CodiceStrumentoOri}',P_StruttAmm='${oModelPosFin.getProperty("/strutturaAmminCentrale").Fictr}',P_PosFin='${oModelPosFin.getProperty("/PosFin/Fipex")}',P_Autorizz='')/Set?`
	  if(sFase === "NV"){
		  sEntityCp = `/ZCOBI_I_PF_DAL_AL_NV(P_AnnoFase='${sAnno}',P_AnnoStr='${sAnno}',P_AnnoSstr='${(parseInt(sAnno) + 2)}',P_PosFin='${oModelPosFin.getProperty("/PosFin/Fipex")}',P_StruttAmm='${oModelPosFin.getProperty("/strutturaAmminCentrale").Fictr}')/Set?sap-client=100`
		  sEntityCs = `/ZCOBI_I_QC_DAL_AL(P_AnnoFase='${sAnno}',P_AnnoStr='${sAnno}',P_AnnoSstr='${(parseInt(sAnno) + 2)}',P_PosFin='${oModelPosFin.getProperty("/PosFin/Fipex")}',P_Autorizz='',P_StruttAmm='${oModelPosFin.getProperty("/strutturaAmminCentrale").Fictr}')/Set?sap-client=100`
		  
		}
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
		}else if(sValue === 'CBREI' ) {
			dalAlCs = false
			//Coding Block
	
			let sEntityCp = `/ZCOBI_I_QC_DAL_AL_DLB(P_AnnoFase='${sAnno}',P_AnnoStr='${sAnno}',P_AnnoSstr='${sAnno}',P_PosFin='${oModelPosFin.getProperty("/PosFin/Fipex")}',P_Autorizz='${oAut.Auth.IdAutorizzazione}',P_StruttAmm='${oModelPosFin.getProperty("/strutturaAmminCentrale").Fictr}')/Set?sap-client=100`
			if(sFase === "NV"){
				sEntityCp = `/ZCOBI_I_QC_DAL_AL(P_AnnoFase='${sAnno}',P_AnnoStr='${sAnno}',P_AnnoSstr='${sAnno}',P_PosFin='${oModelPosFin.getProperty("/PosFin/Fipex")}',P_Autorizz='${oAut.Auth.IdAutorizzazione}',P_StruttAmm='${oModelPosFin.getProperty("/strutturaAmminCentrale").Fictr}')/Set?sap-client=100`

			}
					if(sEntityCp){
						var aReqDalAlCp = await this.__getDataPromise(sEntityCp, [], oModelQuadro);
						this.formatterImporti(aReqDalAlCp, false, "Importo")
						aReqDalAlCp = aReqDalAlCp.sort(
							(a, b) => parseInt(a.YearLow) - parseInt(b.YearLow)
						);
						aReqDalAlCp = aReqDalAlCp.filter(el => el.RecordType === "CP")
						this.getView().setModel(new JSONModel(aReqDalAlCp), `modelTableQuadroDal`);
					}
				}


			this.getView().setModel(new JSONModel({ Title: sTitle, From: sValue , DalAlCs : dalAlCs}), "modelTitle");
			if(bCompOnly){
				this.oDialogQuadroComp.setBusy(false);
			}else{
				this.oDialogQuadro.setBusy(false);
			}
		},

		//--------------------INIZIO LOGICA EXPORT EXCEL MASSIVO ----------------------------------\\

		startExport: function(){
			let oModelPosFin = this.getView().getModel("modelPosFin");
			let oAut = oModelPosFin.getProperty("/CompetenzaAuth");
			if (oAut.Auth === "" || !oAut.Auth) {
				MessageBox.error("Per avere l'export di competenza deve essere selezionata un' autorizzazione nel tab Competenza");
				//this.openMessageBox("Error", "Errore campo Obbligatorio", "Manca l'autorizzazione per la competenza");
				this.getView().setBusy(false)
				return;
			}
			//this.getText("messageDetailSave")
			MessageBox.warning( "L'export Excel richiede del tempo per processare tutti i dati. Attendere la creazione dell'Excel?" ,{
				actions: [MessageBox.Action.YES, MessageBox.Action.NO],
				emphasizedAction: MessageBox.Action.YES, 
				onClose: async function (oAction) {
				if(oAction === "YES"){
					this.openBusyDialog("Contabile")
					//this.getView().setBusy(true);
				try {								
						this.prepareForExport()
						//this.getView().setBusy(false);
				} catch (error) {
					this.closeBusyDialog()
					MessageBox.error("Impossibile effettuare Export")
					return
				} 
				/* MessageBox.information("Salvataggio eseguito con successo!", {
					onClose: function () {
						//this.onSearch()
					}.bind(this)
				}) */
				
				}
			}.bind(this)
		});
		},

		prepareForExport: async function (oEvent) {
			let homeModel = this.getOwnerComponent().getModel("modelHome")
			const oModelQuadro = this.getOwnerComponent().getModel("quadroSac");
			let sAnno = this.getOwnerComponent().getModel("globalModel").getData().ANNO;
			const oModelPosFin = this.getOwnerComponent().getModel("modelPosFin");
			//var variabile = "attachments"

			const isForExport = true
			const arrayOrderQuadro = ["attachments","people"]
			
			
			for (let i = 0; i < arrayOrderQuadro.length; i++) {
				console.time('tempoEsecuzionePartenza');
				var variabile = arrayOrderQuadro[i];
				var aFilters = []
				switch (variabile) {
					case "info":
						break;
					case "attachments":
						// this.showContabileSAC(oEvent);

						await this.showCompetenzaSAC(null,isForExport,"NV")

						/* var sPf = this.getView().getModel("modelPosFin").getProperty("/posFin");
						await this.openIconContExp(sPf, sPf.substring(4, 8), "S", isForExport);
						console.log(`attachments ok`); */
						break;
					case "people":
						this.changeTextToBusy("... Recupero informazioni Cassa")

						try {
							
							await this.showCassaSAC(null,isForExport)
						} catch (error) {
							//debugger
						}

						/* var sEntity = "/QuadroContabileAccantonamenti(P_AreaFin='S001',P_AnnoFase='" + sAnno + "',P_AnnoMin='" + sAnno + "',P_AnnoMax='" + (parseInt(sAnno) + 2) + "',P_Fase='NV'," + "P_PosFin='" + oModelPosFin.getProperty("/posFin").replaceAll(".", "") + "',P_Capitolo='" + oModelPosFin.getProperty("/PosFin/Capitolo") + "')/Set"
						aFilters.push(new Filter("TipoSstr", FilterOperator.EQ, "02"));
						//this.getView().setBusy(true);
						try {
							var aRes = await this.__getDataPromise(sEntity, aFilters, oModelQuadro);
							this.formatterImporti(aRes, false, "", "ACC")
							this.getView().setModel(new JSONModel(aRes), "accantonamentiIGBExt");
							var sEntity = "/MassaAggredibile(P_AreaFin='S001',P_AnnoFase='" + sAnno + "',P_AnnoMin='" + sAnno + "',P_AnnoMax='" + (parseInt(sAnno) + 2) + "',P_Fase='NV',P_PosFin='" + oModelPosFin.getProperty("/posFin").replaceAll(".", "") + "')/Set"
							var aRes = await this.__getDataPromise(sEntity, [], oModelQuadro);
							this.formatterImporti(aRes, false, "", "ACCTAB")
							this.getView().setModel(new JSONModel(aRes), "modelTableAccExt");
							this.getView().setBusy(false);
							console.log(`accantonamentiIGB ok`);							
							break;

						} catch (e) {
							var aRes = [];
							this.getView().setModel(new JSONModel(aRes), "accantonamentiIGBExt");
							console.log(`Errore nel recuper accantonamentiIGBExt, causa: ${e}`);
						} */
						break;
					default:
						break;
				}
		}
		console.timeEnd('tempoEsecuzioneFine');
		this.closeBusyDialog()
		this.exportExcel("Spesa")

		},
		//! lt controllo campi tipo spesa
		controlloObb: async function(oEvent, campoDaControllare){
			var modelPosFin = this.getView().getModel("modelPosFin");
			let posFin = modelPosFin.getProperty("/PosFin");
			let detailAnagrafica = this.getView().getModel("modelPosFin").getProperty("/detailAnagrafica")

			//debugger
			var propertyToCheck = "TipoSpesaPg"
			if(campoDaControllare === "TipoSpesaPg"){
				propertyToCheck = "tipoSpesaCapitolo"
			}

			//if(campoDaControllare === "")


			if(campoDaControllare === "tipoSpesaCapitolo" ){
				if(detailAnagrafica[campoDaControllare] === 'OBB' && detailAnagrafica.CuIrapNoncu === "1"){
					this.getView().getModel("modelPosFin").setProperty(`/detailAnagrafica/${campoDaControllare}`, "")
					MessageBox.warning(this.recuperaTestoI18n("La tipologia spesa non può essere obbligatoria con CU/IRAP/NON CU con valore CEDOLINO Unico"))
					return
				}
			}
			//se non ci sono quei campi da modificare ritorno
			if(campoDaControllare !== "tipoSpesaCapitolo" && campoDaControllare !== "TipoSpesaPg"){
				return
			}

			

			if(detailAnagrafica[campoDaControllare] === 'OBB' && detailAnagrafica[propertyToCheck] === 'OBB'){
				let stringaErrore = ""
				switch (campoDaControllare) {
					case "tipoSpesaCapitolo":
						stringaErrore = "noObbSpesa"
						break;				
					case "TipoSpesaPg":
						stringaErrore = "noObbSpesa2"
						break;
				}


				this.getView().getModel("modelPosFin").setProperty(`/detailAnagrafica/${campoDaControllare}`, "")
				//! inserisco i messaggi di errore
				MessageBox.warning(this.recuperaTestoI18n(stringaErrore))
				return
			}

			if(detailAnagrafica[campoDaControllare] !== 'OBB' && detailAnagrafica[propertyToCheck] !== 'OBB'){
				//cancello l'elento con amministrazione a020
				this.onDeleteElencoObb()
			}

			if(detailAnagrafica[campoDaControllare] === 'OBB' || detailAnagrafica[propertyToCheck] === 'OBB'){
				//! lt creo l'elenco
				this.onDeleteElencoObb()
				//creo l'elento
				this.handleAddElencoOBB(campoDaControllare)

			}
		},

		onChangeCombo: async function(oEvt, sId) {
			var that = this;
			var sResultPgSpe;
			// if (sId !== "idInputTipoSpesaPg") {
			var key = oEvt.getSource().getSelectedItem().getKey();
			// }
			var oModelPosFin = that.getView().getModel("modelPosFin");
			var sModelNoipa = that.getView().getModel("modelNoiPa");
			let aElenchi = that.getView().getModel("modelDeleteElenco").getData();
			if (sId === "idInputTipoSpesa") {
				if (oModelPosFin.getProperty("/PF/CODICE_TIPOSP_CAP_SPE") === "OBB" || key === "OBB") {
					var checkRecord = jQuery.grep(aElenchi, function(record, pos) {
						return (record.CODICE_PG === oModelPosFin.getProperty("/PF/CODICE_PG"))
					});
					if (checkRecord.length === 0) {

						var sCheck = await that.onCheckOBBPg();
						if (sCheck === true) {
							oModelPosFin.setProperty("/PF/CODICE_TIPOSP_CAP_SPE", "");
							oModelPosFin.setProperty("/PF/DESC_CAP_SPE", "");
							return;
						}
					}
				}
				if (oModelPosFin.getProperty("/PF/CODICE_TIPOSP_P_SPE") === "OBB" && key === "OBB") {
					oModelPosFin.setProperty("/PF/CODICE_TIPOSP_CAP_SPE", "");
					oModelPosFin.setProperty("/PF/DESC_CAP_SPE", "");
					if (sap.ui.getCore().byId("idPopUpObb") === undefined) {
						// da togliere
						MessageBox.error(this.recuperaTestoI18n("noObbSpesa"), {
							id: "idPopUpObb"
						})
					}
					return;

				}

				oModelPosFin.setProperty("/PF/CODICE_TIPOSP_CAP_SPE", oModelPosFin.getProperty("/PF/DESC_CAP_SPE"));
				oModelPosFin.setProperty("/PF/DESC_CAP_SPE", oModelPosFin.getProperty("/PF/DESC_CAP_SPE"));
				// if (oModelPosFin.getProperty("/PF/DESC_CAP_SPE") === "OBBLIGATORIO") {
				// 	await that.onCheckPgSpe("", "I");
				// }
				if (key === "OBB") {
					this.addElenco("0");
				} else {
					//rimuovo
					this.addElenco("1");
				}
			}
			if (sId === "idInputTipoSpesa") {

				if ((oModelPosFin.getProperty("/PF/DESC_IRAP_SPE") === "CEDOLINO unico" || oModelPosFin.getProperty("/PF/DESC_IRAP_SPE") ===
						"CEDOLINO UNICO") && oModelPosFin.getProperty("/PF/CODICE_TIPOSP_CAP_SPE") === "OBB") {
					oModelPosFin.setProperty("/PF/CODICE_TIPOSP_CAP_SPE", "");
					oModelPosFin.setProperty("/PF/DESC_CAP_SPE", "");
					if (sap.ui.getCore().byId("idPopUpObb") === undefined) {
						// da togliere
						MessageBox.error(this.recuperaTestoI18n("nonpuoi"), {
							id: "idPopUpObb"
						})
					}
					if (key === "OBB") {
						this.addElenco("1");
					}
					return;
				}
				var sCodiceBre = oModelPosFin.getProperty("/PF/CODICE_TIPOSP_CAP_SPE");
				oModelPosFin.setProperty("/PF/CODICE_TIPOSP_CAP_SPE", sCodiceBre.slice(0, 3));
				oModelPosFin.setProperty("/PF/DESC_CAP_SPE", sCodiceBre);
				if (sCodiceBre.slice(0, 3) === "OBB") {
					this.addElenco("0");
				} else {
					//rimuovo
					this.addElenco("1");
				}
			}

			if (sId === "idInputTipoNaturaSpesa") {
				oModelPosFin.setProperty("/PF/NATURA_SPESA", key);
				oModelPosFin.setProperty("/PF/DESC_NAT_SPE", oEvt.getSource().getSelectedItem().getText());
			}
			if (sId === "idInputCu") {
				if (oModelPosFin.getProperty("/PF/CODICE_TIPOSP_CAP_SPE") === "OBB" && key === "1") {
					oModelPosFin.setProperty("/PF/FLAG_CU_01_SPE", "");
					oModelPosFin.setProperty("/PF/DESC_IRAP_SPE", "");
					if (sap.ui.getCore().byId("idPopUpObb") === undefined) {

						// da togliere
						MessageBox.error(this.recuperaTestoI18n("noCuObb"), {
							id: "idPopUpObb"
						})
					}
					return;
				}
				if (oModelPosFin.getProperty("/PF/DESC_IRAP_SPE") !== "IRAP") {
					var aResultIrap = await this.getIrapSpe();
					var obj;
					var aIrap = that.getView().getModel("modelPosFin").getProperty("/NAV_POSFIN/0/NAV_IRAP");
					aResultIrap.map((a) => {
						obj = [{
							"FIPEX": a.FIPEX
						}]
						that.getView().getModel("modelPosFin").setProperty("/NAV_POSFIN/0/NAV_IRAP", obj);
						// if (aIrap) {
						// 	aIrap.push(obj);
						// } else {
						// 	that.getView().getModel("modelPosFin").setProperty("/NAV_POSFIN/0/NAV_IRAP", obj);
						// }
					});
					// oModelPosFin.setProperty("/NAV_POSFIN/0/NAV_IRAP", aResultIrap);
					// oModelPosFin.getProperty("/PF/NAV_IRAP", aResultIrap);
				}

				oModelPosFin.setProperty("/PF/FLAG_CU_01_SPE", key);
				// oModelPosFin.setProperty("/PF/DESC_IRAP_SPE", oEvt.getSource().getSelectedItem().getText());
				oModelPosFin.setProperty("/PF/DESC_IRAP_SPE", oModelPosFin.getProperty("/PF/DESC_IRAP_SPE"));

				if (key === "0") {
					oModelPosFin.setProperty("/PF/NOI_PA_SPE", "9");
					// oModelPosFin.setProperty("/PF/DESCR_NOIPA_SPE", oEvt.getSource().getSelectedItem().getText());
					oModelPosFin.setProperty("/PF/NOI_PA_SPE", "")
					this.getView().byId("idInputNoipa").setEditable(false);
					if (that.onCheckMode === "CREA") {

						that.errorMess = false;
					}
				} else if (key === "1") {
					this.filterSelectNoipa(key);
					var aNoipaSel = jQuery.grep(sModelNoipa.getData(), function(record, pos) {
						return (record.FLAG_CU_01_SPE === "1" && record.NOI_PA_SPE === "1");
					})[0];
					oModelPosFin.setProperty("/PF/NOI_PA_SPE", aNoipaSel.NOI_PA_SPE);
					oModelPosFin.setProperty("/PF/DESCR_NOIPA_SPE", aNoipaSel.NOIPA_DESCR);
					// oModelPosFin.setProperty("/PF/CODICE_TIPOSP_P_SPE", "OBB");
					// oModelPosFin.setProperty("/PF/DESC_PG_SPE", "OBBLIGATORIO");
					this.getView().byId("idInputNoipa").setEditable(false);
					// var sCedUnico = oModelPosFin.getProperty("/PF/DESC_IRAP_SPE");
					// var sDescPgSpe = oModelPosFin.getProperty("/PF/DESC_PG_SPE");

					// if (sCedUnico !== "" || sDescPgSpe !== "") {
					// 	var oModelFilterHome = this.getView().getModel("modelFilterHome");
					// 	var oSelFoglioObj = oModelPosFin.getData();
					// 	var oDatiPosFin = oSelFoglioObj.PF;
					// 	var oPFtoModify2 = that.getStructureDeepPF("PF_U", that, oModelFilterHome, oModelPosFin, oDatiPosFin);

					// 	var aFilter3 = [];
					// 	aFilter3.push(new Filter("FIKRS", sap.ui.model.FilterOperator.EQ, oPFtoModify2.FIKRS));
					// 	aFilter3.push(new Filter("ANNO", sap.ui.model.FilterOperator.EQ, oPFtoModify2.ANNO));
					// 	aFilter3.push(new Filter("FASE", sap.ui.model.FilterOperator.EQ, oPFtoModify2.FASE));
					// 	// aFilter3.push(new Filter("REALE", sap.ui.model.FilterOperator.EQ, oPFtoModify2.REALE));
					// 	// aFilter3.push(new Filter("VERSIONE", sap.ui.model.FilterOperator.EQ, oPFtoModify2.VERSIONE));
					// 	aFilter3.push(new Filter("CODICE_CAPITOLO", sap.ui.model.FilterOperator.EQ, oPFtoModify2.CODICE_CAPITOLO));
					// 	aFilter3.push(new Filter("EOS", sap.ui.model.FilterOperator.EQ, "S"));
					// 	aFilter3.push(new Filter("PRCTR", sap.ui.model.FilterOperator.EQ, oPFtoModify2.PRCTR));
					// 	// aFilter3.push(new Filter("DATAB", sap.ui.model.FilterOperator.EQ, oPFtoModify2.DATAB));
					// 	aFilter3.push(new Filter("DATBIS", sap.ui.model.FilterOperator.EQ, oPFtoModify2.DATBIS));
					// 	try {
					// 		var aResultPg = await that.readFromDb("6", "/ZES_PF_CHECK_PG_SET", aFilter3, [], "");
					// 		that.errorMess = false;
					// 	} catch (e) {
					// 		that.errorMess = e.message;
					// 	}
					// }
					if (that.onCheckMode === "CREA") {
						that.errorMess = await that.onCheckPgSpe("", "I");
					}
				} else if (key === "2") {
					if (that.onCheckMode === "CREA") {
						that.errorMess = false;
					}
					this.filterSelectNoipa(key);
					aNoipaSel = jQuery.grep(sModelNoipa.getData(), function(record, pos) {
						return (record.FLAG_CU_01_SPE === "2" && record.NOI_PA_SPE === "2");
					})[0];
					oModelPosFin.setProperty("/PF/NOI_PA_SPE", aNoipaSel.NOI_PA_SPE);
					oModelPosFin.setProperty("/PF/DESCR_NOIPA_SPE", aNoipaSel.NOIPA_DESCR);
					this.getView().byId("idInputNoipa").setEditable(false);
				} else {
					if (that.onCheckMode === "CREA") {
						that.errorMess = false;
					}
					this.filterSelectNoipa(key);
					oModelPosFin.setProperty("/PF/NOI_PA_SPE", "");
					oModelPosFin.setProperty("/PF/DESCR_NOIPA_SPE", "");
					this.getView().byId("idInputNoipa").setEditable(true);
				}
			}
			if (sId === "idInputNoipa") {
				oModelPosFin.setProperty("/PF/NOI_PA_SPE", key);
				oModelPosFin.setProperty("/PF/DESCR_NOIPA_SPE", oEvt.getSource().getSelectedItem().getText());
			}
			if (sId === "idInputTipoSpesaPg") {
				// da togliere sDescPgSpe
				var sDescPgSpe = oModelPosFin.getProperty("/PF/DESC_PG_SPE");
				var sDescPgBreveSpe = oModelPosFin.getProperty("/PF/CODICE_TIPOSP_P_SPE");
				var sDescCapBreveSpe = oModelPosFin.getProperty("/PF/CODICE_TIPOSP_CAP_SPE");
				var sCedUnico2 = oModelPosFin.getProperty("/PF/DESC_IRAP_SPE");

				if (sDescPgSpe === "OBBLIGATORIO" && sCedUnico2.toUpperCase() === "CEDOLINO UNICO") {
					if (that.onCheckMode === "CREA") {
						that.errorMess = false;
					}
				} else {
					if (that.onCheckMode === "CREA") {
						that.errorMess = await that.onCheckPgSpe("", "I");
					}
				}
				if (sDescPgSpe !== "OBBLIGATORIO" && sDescPgSpe !== "RIPARTITA" && sDescPgSpe !== "FISSA" && sDescPgSpe !== "ORDINARIA") {
					oModelPosFin.setProperty("/PF/CODICE_TIPOSP_P_SPE", "");
					oModelPosFin.setProperty("/PF/DESC_PG_SPE", "");

					that.addElenco("3");
				} else if (sDescPgSpe === "OBBLIGATORIO" || sDescPgSpe === "RIPARTITA" || sDescPgSpe === "FISSA" || sDescPgSpe === "ORDINARIA" ||
					sDescPgBreveSpe === "SPACE") {
					if (sDescPgBreveSpe === "OBB" && sDescCapBreveSpe === "OBB") {

						oModelPosFin.setProperty("/PF/CODICE_TIPOSP_P_SPE", "");
						oModelPosFin.setProperty("/PF/DESC_PG_SPE", "");
						if (sap.ui.getCore().byId("idPopUpObb") === undefined) {
							// da togliere
							MessageBox.error(this.recuperaTestoI18n("noObbSpesa"), {
								id: "idPopUpObb",
								onClose: function(sAction) {
									that.getView().byId("idInputTipoSpesaPg").setSelectedKey("SPACE")
									oModelPosFin.setProperty("/PF/CODICE_TIPOSP_P_SPE", "");
									oModelPosFin.setProperty("/PF/DESC_PG_SPE", "");
									oModelPosFin.updateBindings(true);
									// oModelPosFin.refresh();
								}
							})
						}

						oModelPosFin.updateBindings(true);
						oModelPosFin.refresh();
						oModelPosFin.setProperty("/PF/CODICE_TIPOSP_P_SPE", "");
						oModelPosFin.setProperty("/PF/DESC_PG_SPE", "");
						return;
					}

					oModelPosFin.setProperty("/PF/DESC_PG_SPE", sDescPgSpe);
					var sDescPgSpeRid = sDescPgSpe.slice(0, 3);
					var oModelTable = this.getView().getModel("modelPosFin").getProperty("/NAV_POSFIN/0/NAV_ELENCHI");
					var sAmm = this.getView().getModel("modelPosFin").getProperty("/NAV_POSFIN/0/PRCTR");

					oModelPosFin.setProperty("/PF/CODICE_TIPOSP_P_SPE", sDescPgSpeRid);
					if (sDescPgSpeRid === "OBB") {

						that.addElenco("2");
					} else {
						//rimuovo
						that.addElenco("3");
					}
					if (sDescPgSpeRid === "") {
						that.addElenco("3");
					}

				} else if (oModelPosFin.getProperty("/PF/FLAG_CU_01_SPE") === "1") {
					oModelPosFin.setProperty("/PF/CODICE_TIPOSP_P_SPE", "OBB");
					oModelPosFin.setProperty("/PF/DESC_PG_SPE", "OBBLIGATORIO");
					if (sap.ui.getCore().byId("idPopUpObb") === undefined) {

						// da togliere
						MessageBox.error(this.recuperaTestoI18n("noObbSpesa2"), {
							id: "idPopUpObb"
						})
					}
					return;

				}

			}
		},

		addElencoOBB: async function(sMod) {
			let modelPosFin = this.getOwnerComponent().getModel("modelPosFin")
			let aElenchi = modelPosFin.getProperty("/NAV_POSFIN/0/NAV_ELENCHI");
			var dElencoA020 = await this.searchA020();
			var that = this;
			
			if (sMod === "0") {
				var sInser = true;
				jQuery.grep(aElenchi, function(record, pos) {
					if (record.ELENCOOBB === "1") {
						sInser = false;
					}
				});
				if (sInser) {
					aElenchi.push({
						PRCTR_ELENCO: "A020",
						NUMERO_ELENCO: "001",
						PRCTR: modelPosFin.getProperty("/PF/PRCTR"),
						DESCR_ELENCHI: dElencoA020,
						CODICE_PG: "00",
						ADDFE: true,
						ELENCOOBB: "1"
					})
					modelPosFin.setProperty("/NAV_POSFIN/0/NAV_ELENCHI", aElenchi);
				}
			} else if (sMod === "1") {
				var sRemuve = false;
				var sIntPos;
				jQuery.grep(aElenchi, function(record, pos) {
					if (record.ELENCOOBB === "1") {
						sRemuve = true;
						sIntPos = pos;
					} else if (record.CODICE_PG === "00" && record.PRCTR_ELENCO === "A020" && record.NUMERO_ELENCO === "001") {
						sRemuve = true;
						sIntPos = pos;
						that.getView().getModel("modelDeleteElenco").getData().push(record);
					}
				});
				if (sRemuve) {
					aElenchi.splice(sIntPos, 1);
					modelPosFin.setProperty("/NAV_POSFIN/0/NAV_ELENCHI", aElenchi);
				}

			} else if (sMod === "2") {
				var oModelTable = modelPosFin.getProperty("/NAV_POSFIN/0/NAV_ELENCHI");
				var sAmm = modelPosFin.getProperty("/PF/PRCTR");
				var sCodPG = modelPosFin.getProperty("/PF/CODICE_PG");
				var sCodCap = modelPosFin.getProperty("/PF/CODICE_CAPITOLO");
				var sRes = oModelTable.find(a => a.PRCTR === sAmm && a.CODICE_PG === sCodPG && a.CODICE_CAPITOLO === sCodCap);

				var sInser = true;
				jQuery.grep(aElenchi, function(record, pos) {
					if (record.ELENCOOBB === "2") {
						sInser = false;
					}
				});
				if (sRes === undefined) {
					if (sInser) {
						aElenchi.push({
							PRCTR_ELENCO: "A020",
							NUMERO_ELENCO: "001",
							PRCTR: modelPosFin.getProperty("/PF/PRCTR"),
							DESCR_ELENCHI: dElencoA020,
							CODICE_PG: modelPosFin.getProperty("/PF/CODICE_PG"),
							ADDFE: true,
							ELENCOOBB: "2"
						})
						modelPosFin.setProperty("/NAV_POSFIN/0/NAV_ELENCHI", aElenchi);
					}
				}
			} else if (sMod === "3") {
				var sRemuve = false;
				var sIntPos;
				jQuery.grep(aElenchi, function(record, pos) {
					if (record.ELENCOOBB === "2") {
						sRemuve = true;
						sIntPos = pos;
					} else if (record.CODICE_PG === modelPosFin.getProperty("/PF/CODICE_PG")) {
						sRemuve = true;
						sIntPos = pos;
						that.getView().getModel("modelDeleteElenco").getData().push(record);
					}
				});
				if (sRemuve) {
					aElenchi.splice(sIntPos, 1);
					modelPosFin.setProperty("/NAV_POSFIN/0/NAV_ELENCHI", aElenchi);
				}

			} else {
				if (modelPosFin.getProperty("/descElenco") && modelPosFin.getProperty("/codiceElenco")) {
					aElenchi.push({
						PRCTR_ELENCO: modelPosFin.getProperty("/PF/PRCTR"),
						NUMERO_ELENCO: modelPosFin.getProperty("/codiceElenco"),
						PRCTR: modelPosFin.getProperty("/PF/PRCTR"),
						DESCR_ELENCHI: modelPosFin.getProperty("/descElenco"),
						CODICE_PG: "00",
						ADDFE: true,
						ELENCOOBB: false
							// PG: "00"
					})
					modelPosFin.setProperty("/NAV_POSFIN/0/NAV_ELENCHI", aElenchi)
					this.handlecloseElenco();
				}
			}

		},
		searchA020: async function() {
			var aPRCTR = "A020";
			var AElenco = "001";
			var modelPosFin = this.getView().getModel("modelPosFin").getData()
						var detailAnagrafica = modelPosFin.detailAnagrafica
			var aCodCapitolo = detailAnagrafica.CAPITOLO;

			var aFilter = [];
			aFilter.push(new Filter("FIKRS", sap.ui.model.FilterOperator.EQ, "S001")); //Attualmente statico per necessità
			aFilter.push(new Filter("ANNO", sap.ui.model.FilterOperator.EQ, this.getView().getModel("globalModel").getProperty("/ANNO")));
			aFilter.push(new Filter("FASE", sap.ui.model.FilterOperator.EQ, "NV"));
			aFilter.push(new Filter("REALE", sap.ui.model.FilterOperator.EQ, "R"));
			aFilter.push(new Filter("VERSIONE", sap.ui.model.FilterOperator.EQ, "D"));
			aFilter.push(new Filter("PRCTR", sap.ui.model.FilterOperator.EQ, aPRCTR));
			aFilter.push(new Filter("NUMERO_ELENCO", sap.ui.model.FilterOperator.EQ, AElenco));
			try {
				var aResult = await this.readFromDb("4", "/ZES_ELENCHI_SPE_SET", aFilter, [], "", "");
				var descrElenco = aResult[0].DESCR_ELENCHI;
			} catch (error) {
				aResult = [];
				// if (error.codeError === "ZCA_CUST_MESS/009") {
				// 	this.messageChangeStato(error.message, "", "", "error");
				// }
			}
			return descrElenco;
		},

	});
});