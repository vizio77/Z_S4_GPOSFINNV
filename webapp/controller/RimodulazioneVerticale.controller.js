sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/core/Fragment",
	"sap/m/MessageBox",
	"sap/ui/core/routing/History",
	"./BaseController",
	"../model/formatter",
], function(Controller, JSONModel, Filter, FilterOperator, Fragment, MessageBox, History, BaseController, formatter) {
	"use strict";
	return BaseController.extend("zsap.com.r3.cobi.s4.gestposfinnv.controller.RimodulazioneVerticale", {
		/**
		 * @override
		 */

		formatter: formatter,
				
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
					//let oRimVerticaliSac = this.getView().byId("linkSac")
					//document.getElementById(oRimVerticaliSac.getId()).setAttribute("src", "")
				}
			})
			oRouter.getRoute("RimodulazioneVerticale").attachPatternMatched(this._onObjectMatched, this);
        },
        _onObjectMatched: async function (oEvent) {
			this.getView().setBusy(true)
			this.getView().setModel(new JSONModel({}),"modelPluri")
			this.getView().setModel(new JSONModel({panel : false}),"modelVisibility")//lt metteere a false per evitare di vedere la struttura fiori

			/* this.getView().setModel(new JSONModel({Cedente : [{
						  CodificaRepPf: "S020100102.320201.010101",
							ZzdescrEstesaFm: "RD n. 523 / 1904 - FL - BASE",
							ValRicevente: "10.000,00"
					}],
					Riceventi : [{
						  CodificaRepPf: "S020126202.060502.040101",
							ZzdescrEstesaFm: "DL n. 98 / 2011 art. 37. comma 20 - FL - BASE",
							ValCedente: "100,00"
					}],
					AnniMov : [{Anno : 2025}, {Anno : 2026}]
				}), "modelRimVert") */
				//this.checkTotRim()
            this.getView().setModel(new JSONModel({
                infoSottoStrumento: {},
                tablePosFinRicCed: [],
                Anno: null,
                visibleRiceCede: false,
				disableModificaRicerca: false,
                formCedenteRicevente: {}
            }), "modelRimVerticali")
			this.getOwnerComponent().setModel(new JSONModel({
                formPosFin: {},
                posFinHelp: {},
                elencoPosFin: [],
				detailAnagrafica: {}
            }),"modelPosFin")

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
					}else{
						modelRimVerticali.setProperty("/formCedenteRicevente/DescrizioneCompatta", undefined)
						modelRimVerticali.setProperty("/formCedenteRicevente/Auth", undefined)
						modelRimVerticali.setProperty("/formCedenteRicevente/DescrInputAuthAssociata", undefined)
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
		onPressConfPosFin: async function (oEvent) {
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
			const afilterCheck = this.__setFiltersCheckAuthVsPf(aFilters)
			aFilters = this.__setDomSStrFilters(aFilters)

			modelPosFin.setProperty("/elencoPosFin", [])

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

			let listaPosFinAvaible = await this.__getDataPromise("/ZET_POSFIN_AUT_FL", afilterCheck , modelHana);
			if(listaPosFinAvaible.length === 0){
				modelPosFin.setProperty("/elencoPosFin", [])
				modelPosFin.setProperty("/tablePosFinBusy", false)
				return;
			}
			let listaPosFin = await this.__getDataPromise("/PosizioneFinanziariaSet", aFilters , modelHana);

			var arrayPosFin = []
			listaPosFinAvaible.forEach(pos => {
				const fondPosFin =  listaPosFin.find((el) => el.CodificaRepPf === pos.CODIFICA_REP_PF)
				if(fondPosFin) arrayPosFin.push(fondPosFin)
			});

			modelPosFin.setProperty("/elencoPosFin", arrayPosFin)
			modelPosFin.setProperty("/tablePosFinBusy", false)
		},
		onConfirmTablePosFin: function (oEvent) {
			const modelPosFin = this.getOwnerComponent().getModel("modelPosFin")
			const modelRimVerticali = this.getView().getModel("modelRimVerticali")
			const oSelectedPosFin = modelPosFin.getProperty(oEvent.getParameter("selectedItem").getBindingContextPath())
			modelRimVerticali.setProperty("/formCedenteRicevente/Fipex", oSelectedPosFin.CodificaRepPf) // old value Fipex)
			modelRimVerticali.setProperty("/formCedenteRicevente/PosFin", oSelectedPosFin)
			modelPosFin.setProperty("/elencoPosFin", [])
			
			if(oSelectedPosFin.CodificaRepPf) this._getSingleAutorizzazione()
			this.oDialogPosFin.close()
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
			
			const checkFaseAperta = await this.checkFaseAperta(oFormCodingBlock)
			if(!checkFaseAperta){
				return;
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

		checkFaseAperta: async function(oFormCodingBlock){
			
			let homeModel = this.getView().getModel("modelPosFin")
			const oSottostrumento = homeModel.getProperty("/infoSottoStrumento")
			let aFilters = [
				new Filter("Anno", FilterOperator.EQ, oSottostrumento.AnnoSstr),
				new Filter("Fase", FilterOperator.EQ, oSottostrumento.Fase),
				new Filter("TipoSstr", FilterOperator.EQ, oSottostrumento.TipoSstr),
				new Filter("FlagStatus", FilterOperator.EQ, '1'),
				new Filter("Prctr", FilterOperator.EQ, oFormCodingBlock.PosFin.Prctr),
				new Filter("StatoAmmin", FilterOperator.EQ, '1'),
			]

			let res = await this._getEntitySet("/FasiAmminSStrSet", aFilters, this.getOwnerComponent().getModel("sapHanaS2"))
				if (res['/FasiAmminSStrSet']) {
					return true
				} else {						
					MessageBox.warning("Operazione non consentita. Lo stato della fase e/o dell'amministrazione selezionata risulta chiusa")
					return false
				}
			
		},

		onPoMovAnno: function (oEvent) {
			var oButton = oEvent.getSource(),
			oView = this.getView();

			// create popover
			if (!this.popOverMovAnno) {
				this.popOverMovAnno = Fragment.load({
					id: oView.getId(),
					name: "zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.HVPosFin.PopOverAnniMov",
					controller: this
				}).then(function(oPopover) {
					oView.addDependent(oPopover);
					return oPopover;
				});
			}
			this.popOverMovAnno.then(function(oPopover) {
				oPopover.openBy(oButton);
			});
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
			aRiceventi = aRiceventi.filter((ric) => ric.Autorizzazione !== "SYSTSPESE")
			if(aRiceventi.length > 0){
				MessageBox.show(`${aRiceventi.length === 1 ? 'É stata trovata ' : "Sono state trovate"} ${aRiceventi.length} ${aRiceventi.length === 1 ? 'ricevente collegata': 'riceventi collegate'} alla cedente selezionata`)
				this.rimVertPassate = true
			}else{
				this.rimVertPassate = false
			}
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
			this.getView().setModel(new JSONModel({panel : false}),"modelVisibility")
			//let oRimVerticaliSac = this.getView().byId("linkSac");
			//document.getElementById(oRimVerticaliSac.getId()).setAttribute("src", "");

		},
		onExpandPopOverPosFin: async function (oEvent) {
			const modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			const modelRimVerticali = this.getView().getModel("modelRimVerticali")
			const modelPosFin = this.getOwnerComponent().getModel("modelPosFin")

			let sPath= oEvent.getSource().getParent().getBindingContextPath()
			let oPosFin = modelRimVerticali.getProperty(sPath)
			modelPosFin.setProperty("/PosFin", oPosFin)
			// this.__getAttributiDescrPosFin(oPosFin, modelHana)
			// 	.then((res) =>{
			// 		for (let i = 0; i < res.length; i++) {
			// 			if(res[i]["/TipAmministrazioneSet"]) {
			// 				modelPosFin.setProperty("/detailAnagrafica/AMMINISTAZIONE", res[i]["/TipAmministrazioneSet"].Prctr)
			// 				modelPosFin.setProperty("/detailAnagrafica/DESC_AMMINISTAZIONE", res[i]["/TipAmministrazioneSet"].DescEstesa)
			// 			}
			// 			if(res[i]["/TipCapitoloSet"]) {
			// 				modelPosFin.setProperty("/detailAnagrafica/CAPITOLO", res[i]["/TipCapitoloSet"].Capitolo)
			// 				modelPosFin.setProperty("/detailAnagrafica/DESC_CAPITOLO", res[i]["/TipCapitoloSet"].DescEstesaCapitolo)
			// 				modelPosFin.setProperty("/detailAnagrafica/pg", res[i]["/TipCapitoloSet"].Pg)
			// 				modelPosFin.setProperty("/detailAnagrafica/DESC_PG", res[i]["/TipCapitoloSet"].DescEstesaPg)
			// 			}
			// 			if(res[i]["/TipTitoloSet"]) {
			// 				modelPosFin.setProperty("/detailAnagrafica/TITOLO", res[i]["/TipTitoloSet"].Titolo)
			// 				modelPosFin.setProperty("/detailAnagrafica/DESC_TITOLO", res[i]["/TipTitoloSet"].DescEstesaTitolo)
			// 				modelPosFin.setProperty("/detailAnagrafica/CATEGORIA", res[i]["/TipTitoloSet"].Categoria)
			// 				modelPosFin.setProperty("/detailAnagrafica/DESC_CATEGORIA", res[i]["/TipTitoloSet"].DescEstesaCategoria)
			// 				modelPosFin.setProperty("/detailAnagrafica/CE2", res[i]["/TipTitoloSet"].Ce2)
			// 				modelPosFin.setProperty("/detailAnagrafica/DESC_CE2", res[i]["/TipTitoloSet"].DescEstesaCe2)
			// 				modelPosFin.setProperty("/detailAnagrafica/CE3", res[i]["/TipTitoloSet"].Ce3)
			// 				modelPosFin.setProperty("/detailAnagrafica/DESC_CE3", res[i]["/TipTitoloSet"].DescEstesaCe3)
			// 			}
			// 			if(res[i]["/TipMissioneSet"]) {
			// 				modelPosFin.setProperty("/detailAnagrafica/MISSIONE", res[i]["/TipMissioneSet"].Missione)
			// 				modelPosFin.setProperty("/detailAnagrafica/DESC_MISSIONE", res[i]["/TipMissioneSet"].DescEstesaMissione)
			// 				modelPosFin.setProperty("/detailAnagrafica/PROGRAMMA", res[i]["/TipMissioneSet"].Programma)
			// 				modelPosFin.setProperty("/detailAnagrafica/DESC_PROGRAMMA", res[i]["/TipMissioneSet"].DescEstesaProgramma)
			// 				modelPosFin.setProperty("/detailAnagrafica/AZIONE", res[i]["/TipMissioneSet"].Azione)
			// 				modelPosFin.setProperty("/detailAnagrafica/DESC_AZIONE", res[i]["/TipMissioneSet"].DescEstesaAzione)
			// 			}
			// 		}
			// 		this._pPopover.then(function(oPopover) {
			// 			oPopover.setBusy(false)
			// 		})
			// 	})
			// 	.catch((error) => {
			// 		console.error(error.message)
			// 	  });
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
		onPressAvvioSac: async function (oEvent) {
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

							//debugger

				/* VarMulti.then((res) => {
					let payload = {
						SemObj: "GEST_POSFIN",
						Schermata: "RIM_VERT",
						VarMulti: [...res]
					}
					modelHana.create("/SacUrlSet", payload,{
						success:  (oData, res) => {
							//debugger
							this.getView().setBusy(false)
							//let oRimVerticaliSac = this.getView().byId("linkSac");
							//lt 20231010 -> richiesta da Nicola P. l'invio del parametro p_EsisteId per capire se è già stata rimodulata la PF
							//document.getElementById(oRimVerticaliSac.getId()).setAttribute("src", `${oData.Url}&p_EsisteId=${this.rimVertPassate}`);
							window.frames[0].location = oData.Url + (new Date());
							modelRimVerticali.setProperty("/disableModificaRicerca", true)
						},
						error: (res) => {
							//debugger
							this.getView().setBusy(false)
							return MessageBox.error("Errore")
						}
					})
				}) */
				this.getView().setBusy(false)
				this.createModelRim(aCBCheck,VarMulti)

				this.getView().getModel("modelVisibility").setProperty("/panel",true)
				modelRimVerticali.setProperty("/disableModificaRicerca", true)

			} else {
				if(!aCBCheck.find(cb => cb.CedeRice === "CEDENTE")) {
					return MessageBox.error("Inserire un Cedente")
				} 
				if(!aCBCheck.find(cb => cb.CedeRice === "RICEVENTE")){
					return MessageBox.error("Inserire almeno un Ricevente")
				}
			}
		},

		createModelRim: function(aCBCheck,VarMulti){

			//debugger
			var cedente = []
			var ricevente = []
			var righeErrore = []
			var cedenteDisattivo = false
			var riceventeDisattivo = false
			/* aCBCheck.forEach(el => {	
				el.StatusCapitolo  = '3' 

				}); */
			aCBCheck.forEach(el => {	
				let stringa = ""			
				let captioloDisattivo = false
				if(el.CedeRice === 'CEDENTE'){
					el.ValCedente = "0,00"
					cedente.push(el)					
				}else{
					el.ValRicevente = "0,00"
					ricevente.push(el)
				}
				if(el.StatusCapitolo === '3' || el.StatusPg === '3'){		
					cedenteDisattivo = true		
					if(el.StatusCapitolo === '3'){
						stringa = `Il ${this.capitalizeString(el.CedeRice)} con Posizione Finanziaria ${el.Codifica_rep_pf} ha il capitolo disattivato`
						captioloDisattivo = true
					}	
					if(el.StatusPg === '3'){
						!captioloDisattivo ? stringa = `Il ${this.capitalizeString(el.CedeRice)} con Posizione Finanziaria ${el.Codifica_rep_pf} ha il pg disattivato` : stringa = `la Posizione Finanziaria ${el.Codifica_rep_pf} ha il capitolo e il pg disattivato`
					}	
				}
				if(stringa !== "") righeErrore.push(stringa) 
			});
			let canSave = true
			if(righeErrore.length > 0){
				MessageBox.warning(`Non è possibile effettuare il salvataggio per i seguenti motivi:\n ${righeErrore.toString().replaceAll(",","\n")}`)
				canSave = false
			}

			this.getView().setModel(new JSONModel({
				AllineaCassa: false,
				CanSave : canSave,
				Cedente : cedente,
				Riceventi : ricevente,
				AnniMov : []
			}), "modelRimVert")

			this.checkTotRim()
			/* this.getView().setModel(new JSONModel({Cedente : [{p
				CodificaRepPf: "S020100102.320201.010101",
				ZzdescrEstesaFm: "RD n. 523 / 1904 - FL - BASE",
					ValRicevente: "10.000,00"
				}],
				Riceventi : [{
						CodificaRepPf: "S020126202.060502.040101",
						ZzdescrEstesaFm: "DL n. 98 / 2011 art. 37. comma 20 - FL - BASE",
						ValCedente: "100,00"
				}],
				AnniMov : [{Anno : 2025}, {Anno : 2026}]
			}), "modelRimVert") */

		},

		capitalizeString : function(str) {
			return str.charAt(0).toUpperCase() + str.toLowerCase().slice(1);
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
		},
		onSaveVertical: function(){

			var modelRimData = this.getView().getModel("modelRimVert").getData()
			let errore = false
			modelRimData.Cedente.forEach(el => {
				if(parseInt(el.ValCedente) >= 0){
					MessageBox.warning("Il valore del cedente deve avere importo negativo")
					errore = true
				}				
			});

			if(errore) return


			if(parseInt(modelRimData.DiffFormatted) !== 0){
				MessageBox.warning("Operazione non consentita. Le variazioni imputate tra cedente e ricevente non sono compensative tra loro")
				return
			}
			const oModelVarCont = this.getOwnerComponent().getModel("modemVarCont")
			var oPayload = this.createPayloadVert()

			//const controlloSomma = this.checkSumEqualZero(oPayload)
			if(!oPayload){
				return
			}

			//! LT -> mando i $ nell'oData per imputare i dati
			console.log(oPayload)
			MessageBox.show(
				this.recuperaTestoI18n("confermaSalvataggio"), {
					icon: MessageBox.Icon.INFORMATION,
					title: "Salvataggio ",
					actions: [MessageBox.Action.YES, MessageBox.Action.NO],
					emphasizedAction: MessageBox.Action.YES,
					onClose:async function  (oAction) { 
						if(oAction === "YES"){
							sap.ui.core.BusyIndicator.show();	
							var path = "/Rimodulazioni_verticaliSet"
							const invio  = await this.__setDataPromiseSaveBW( path ,oModelVarCont, {}, oPayload)		
							sap.ui.core.BusyIndicator.hide()
							if(invio.success) {
								MessageBox.success("Operazione eseguita con successo")
								//TODO reset modello pluri
								this.getView().setModel(new JSONModel({}),"modelPluri")
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
		createPayloadVar: function(isTestata, valori, isPluri){
			var modelRimVert = this.getView().getModel("modelRimVert").getData();
			let modelPosFin = this.getView().getModel("modelPosFin");
			let modelVert = this.getView().getModel("modelRimVerticali");
			let posFin = modelPosFin.getProperty("/PosFin");
			const esercizio = this.getView().getModel("globalModel").getProperty("/ANNO")
			var infoSottoStrumento = modelPosFin.getProperty("/infoSottoStrumento")

			const importo = valori.CedeRice === "CEDENTE" ? valori.ValCedente : valori.ValRicevente
			let anno = modelVert.getProperty("/Anno")
			let payload = {
				"Fikrs" : "S001",
				"Anno" : esercizio,
				"Fase" : "NV",
				"Reale" : "R",
				"Versione" : valori.Versione,
				"Fipex" : valori.Fipex,
				"Fictr" : valori.Fictr,
				//"Fincodecoll" :modelFilterData.autColl,
				"Fincode" : valori.IdAutorizzazione,
				"Importo" : importo,
				"CodiceStrumento" : infoSottoStrumento.CodiceStrumento,
				"CodiceStrumentoOri" : infoSottoStrumento.CodiceStrumentoOri,
				"CodiceSottostrumento" : infoSottoStrumento.CodiceSottostrumento,
				"AnnoMovimento" : !isPluri ? anno : anno,				
				"Capitolo" : valori.Capitolo,
				"Ruolo" : valori.CedeRice,
				"Eos" : valori.Eos
			}
			if(payload.Importo) payload.Importo =  payload.Importo.replace(",00","").replaceAll(".", "");
			if(isTestata){
				payload.UPDATEDEEPRIMVERT = []
			}else{
				payload.AllineaCassa = !modelRimVert.AllineaCassa ? false : true
				//payload.Ricorrenza = !valori.Ricorrenza ? "" : valori.Ricorrenza
			}
			return payload
		},
		recuperaTestoI18n: function(testoDaRecuperare) {
			return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText(testoDaRecuperare);
		},
		createPayloadVert: function(){
			
			var modelRimVert = this.getView().getModel("modelRimVert").getData()
			var modelPluri = this.getView().getModel("modelPluri");
			let modelPosFin = this.getView().getModel("modelPosFin");

			var modelPluriData = modelPluri.getData()
			
			
			//! creo la testata
			/*  var oPayload = this.createPayloadVar(true, {
				AllineaCassa : modelRimVert.AllineaCassa
			})  */
			var arrayPosizioni = []
			modelRimVert.Cedente.forEach(element => {
				arrayPosizioni.push(this.createPayloadVar(false, element))
			}); 
			modelRimVert.Riceventi.forEach(element => {
				arrayPosizioni.push(this.createPayloadVar(false, element))
			}); 
			//!lt creo la testata con il cedente
			if(arrayPosizioni.length > 0){
				var oPayload = this.createPayloadVar(true, modelRimVert.Cedente[0]) 
			}

			//! lt gestisto la popup dei plurienni
			var arrayPosizioniPluri = []
				if(modelPluriData){
					//creo il singolo anno dei pluriennali
					if(modelPluriData &&  modelPluriData.NAV_PLUR && modelPluriData.NAV_PLUR.length > 0){
						//lt trovo tutti i record con un anno dal al valorizzato
						let recordDaInviare = modelPluriData.NAV_PLUR.filter(row => row.annoDal !== "" && row.annoAl !== "")
						for (let i = 0; i < recordDaInviare.length; i++) {
							const row = recordDaInviare[i];
							let annoDal = parseInt(row.annoDal) 
							let annoAl = parseInt(row.annoAl) 
							let ricorrenza = parseInt(row.ricorrenza) 
							if(ricorrenza === 0) ricorrenza = 1
							//!lt creo per ogni anno dei pluriennali le righe
							for (let z = annoDal; z <= annoAl; z = z + ricorrenza) {
								console.log(z)
								const annoRicorrente = parseInt(z)
								//if(annoRicorrente > annoAl) break
								arrayPosizioni.forEach(el => {
									var cloneEl = jQuery.extend(true, {}, el)
									cloneEl.AnnoMovimento = annoRicorrente.toString()
									arrayPosizioniPluri.push(cloneEl)
								});
								
							}
						}
					}					
					
				}

				oPayload.UPDATEDEEPRIMVERT = [...arrayPosizioni,...arrayPosizioniPluri]
				//debugger
				/* if(oPayload.UPDATEDEEPRIMVERT.length === 0){
					MessageBox.warning("Non ci sono valori da imputare")
					return false
				} */
				return oPayload
		},
		openquadroCont: async function (sValue, oEvent, sPF, sCP, sCB) {
			this.getView().setBusy(true);
			this.getView().setModel(new JSONModel([{}]), "modelTableQuadro");
			const oModelQuadro = this.getOwnerComponent().getModel("ZSS4_COBI_QUADRO_CONTABILE_DLB_SRV")
			let oModelPosFin = this.getView().getModel("modelPosFin");
			let sAnno = this.getOwnerComponent().getModel("globalModel").getData().ANNO;
			var aDataRim = this.getView().getModel("modelRimVerticali").getData().tablePosFinRicCed;
			this.getView().setModel(new JSONModel({
				Title:""
				}),"TitoloExport")
				
			var object = oEvent.getSource().getBindingContext("modelRimVerticali").getObject()
			
			var aSingRim = aDataRim.filter((word) => word.Fipex === sPF && word.Capitolo === sCP)
			if (sValue === "CAP") {
				if (sCP.length !== 0) {
					var sEntity = "/QuadroContabile(P_Disp=true,P_AreaFin='S001',P_AnnoFase='" + sAnno + "',P_AnnoMin='" + sAnno + "',P_AnnoMax='" + (parseInt(sAnno) + 2) + "',P_Fase='NV',P_Eos='S',P_PosFin='" + sPF.replaceAll(".", "") + "',P_Autorizz='',P_Capitolo='" + sCP + "',P_RecordType='OC')/Set"
				} else {
					var sEntity = "/QuadroContabile(P_Disp=true,P_AreaFin='S001',P_AnnoFase='" + sAnno + "',P_AnnoMin='" + sAnno + "',P_AnnoMax='" + (parseInt(sAnno) + 2) + "',P_Fase='NV',P_Eos='S',P_PosFin='" + oModelPosFin.getProperty("/posFin").replaceAll(".", "") + "',P_Autorizz='',P_Capitolo='" + oModelPosFin.getProperty("/PosFin/Capitolo") + "',P_RecordType='OC')/Set"
				}

				var sTitle = "Quadro Contabile Capitolo " + aSingRim[0].Prctr + " " + aSingRim[0].Capitolo;
				this.getView().getModel("TitoloExport").setProperty("/Title",sTitle)

			} else if (sValue === "PF") {
				if (sPF.length !== 0) {
					var sEntity = "/QuadroContabile(P_Disp=true,P_AreaFin='S001',P_AnnoFase='" + sAnno + "',P_AnnoMin='" + sAnno + "',P_AnnoMax='" + (parseInt(sAnno) + 2) + "',P_Fase='NV',P_Eos='S',P_PosFin='" + sPF.replaceAll(".", "") + "',P_Autorizz='',P_Capitolo='" + sCP + "',P_RecordType='OP')/Set"
				} else {
					var sEntity = "/QuadroContabile(P_Disp=true,P_AreaFin='S001',P_AnnoFase='" + sAnno + "',P_AnnoMin='" + sAnno + "',P_AnnoMax='" + (parseInt(sAnno) + 2) + "',P_Fase='NV',P_Eos='S',P_PosFin='" + oModelPosFin.getProperty("/posFin").replaceAll(".", "") + "',P_Autorizz='',P_Capitolo='" + oModelPosFin.getProperty("/PosFin/Capitolo") + "',P_RecordType='OP')/Set"
				}

				var sTitle = "Quadro Contabile Posizione Finanziaria " + aSingRim[0].Prctr + " " +aSingRim[0].Capitolo+"."+aSingRim[0].Pg;
				this.getView().getModel("TitoloExport").setProperty("/Title",sTitle)
			} else {

				var aSingRimCB = aSingRim.filter((word) => word.IdAutorizzazione === sCB)
				if (sCB.length !== 0) {
					var sEntity = "/QuadroContabile(P_Disp=true,P_AreaFin='S001',P_AnnoFase='" + sAnno + "',P_AnnoMin='" + sAnno + "',P_AnnoMax='" + (parseInt(sAnno) + 2) + "',P_Fase='NV',P_Eos='S',P_PosFin='" + sPF.replaceAll(".", "") + "',P_Autorizz='" + sCB + "',P_Capitolo='" + sCP + "',P_RecordType='CB')/Set"
				} else {
					var sEntity = "/QuadroContabile(P_Disp=true,P_AreaFin='S001',P_AnnoFase='" + sAnno + "',P_AnnoMin='" + sAnno + "',P_AnnoMax='" + (parseInt(sAnno) + 2) + "',P_Fase='NV',P_Eos='S',P_PosFin='" + oModelPosFin.getProperty("/posFin") + "',P_Autorizz='" + oAut.Auth.IdAutorizzazione + "',P_Capitolo='" + oModelPosFin.getProperty("/PosFin/Capitolo") + "',P_RecordType='CB')/Set"
				}

				var sTitle = "Quadro Contabile del Coding Block  " + aSingRim[0].Prctr + " " +aSingRim[0].Capitolo+"."+aSingRim[0].Pg + " " + aSingRim[0].ZzdescrEstesaFm;
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

		functionTemp: function (sIdTable, sIdColumnListItem, sModel, sText, sNameCell) {
			this.addCol(sIdTable, sIdColumnListItem, sModel, sText, sNameCell);
		},

		addCol: function (sIdTable, sIdColumnListItem, sModel, sText, sNameCell) {
			var that = this;


			var sTable = this.getView().byId(sIdTable),
				sAnnoKey, sAnnoValue,
				intEsercizio = parseInt(this.getOwnerComponent().getModel("globalModel").getData().ANNO),
				sColumnListItem = this.getView().byId(sIdColumnListItem),
				sRecord = {},
				arrRelYear = [];


			if (!sTable) {
				sTable = sap.ui.getCore().byId(sIdTable);
			}
			if (!sColumnListItem) {
				sColumnListItem = sap.ui.getCore().byId(sIdColumnListItem);
			}
			var j = 1;
			for (var i = 0; i < 3; i++) {

				if (i < 10) {
					var sTextV = sText + "00"
				} else if (i > 10 && i < 100) {
					var sTextV = sText + "0"
				}

				sAnnoKey = this.recuperaTestoI18n(sNameCell) + " " + (intEsercizio + i);
				sTable.addColumn(new sap.m.Column({
					header: new sap.m.Label({
						text: sAnnoKey,
						design: "Bold"

					}),
					width: "20%",

					hAlign: "Right",
				}));
			}

		},

		recuperaTestoI18n: function (testoDaRecuperare) {
			return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText(testoDaRecuperare);
		},

		resetValue: function(oEvent, model, attributo){
			const path = oEvent.getSource().getBindingContext(model).getPath()
			this.getView().getModel(model).setProperty(path + '/' + attributo, '0,00')
		}
		
    });
});