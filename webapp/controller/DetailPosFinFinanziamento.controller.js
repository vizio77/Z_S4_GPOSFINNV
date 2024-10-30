sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/core/Fragment",
	"sap/m/MessageBox",
	"z_s4_crosslock/crosslock/controls/Lock",
	"sap/ui/core/routing/History",
	"sap/m/library",
	"./DetailPosFin.controller",
	"sap/ui/core/format/NumberFormat",
	"sap/ui/core/BusyIndicator"
], function(Controller, JSONModel, Filter, FilterOperator, Fragment, MessageBox, Lock, History, mobileLibrary, DetailPosFin, NumberFormat, BusyIndicator) {
	"use strict";
	var DialogType = mobileLibrary.DialogType;
	var variabGlobal;
	return DetailPosFin.extend("zsap.com.r3.cobi.s4.gestposfinnv.controller.DetailPosFinFinanziamento", {
		/**
		 * @override
		 */
		Lock: Lock,
		onInit: async function() {
			this.getView().setModel(new JSONModel({
				detailAnagrafica: {}
			}), "modelPosFin")
			// this.getView().getModel("modelPosFin").setProperty("/detailAnagrafica", {})
			var oRouter = this.getOwnerComponent().getRouter();
			oRouter.getRoute("DetailPosFinFinanziamento").attachPatternMatched(this._onObjectMatched, this);
			this.firstTime = true;
			this.createModelAnnoSelect();
			this.functionTemp("idTableyearFin", "idColumnListItemsYearFin", "modelTable", "ImportoCPAnno", "Competenza");

			this.firstTime = false;
			this.open = false;
			this.setModelFilter();								
			variabGlobal = this;
			var that = this;
			window.addEventListener('beforeunload', async function(oEvent) {
				console.log(`la proprietà unlock è: ${that.unlock} , arriva da addEventListener`);
				if(that.unlock) await that.unLockPosFin();
			});
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


		/**
		 * Event handler 
		 * 
		 * @param {sap.ui.base.Event} oEvent - Event class
		 * @public
		 */
		onExpandPopOverAutorizzazione: function (oEvent) {
			var oButton = oEvent.getSource(),
			oView = this.getView();
			/** @type {sap.ui.model.json.JSONModel} */
			var oModelPosFinModel = this.getView().getModel("modelPosFin");
			var oAuth = oModelPosFinModel.getProperty("/Auth");
			oModelPosFinModel.setProperty("/Finanziamento", {
				Amministrazione: oAuth
			})
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
		/**
		 * 
		 * 
		 * @param {string} Fikrs 
		 * @param {string} Fincode 
		 * @public
		 */
		getAuth: async function (Fincode, Fikrs) {
			const modelHana = this.getOwnerComponent().getModel("sapHanaS2Revisione")
			const modelPosFin = this.getView().getModel("modelPosFin");
			let aFilters= [
				new Filter("Fikrs", FilterOperator.EQ, Fikrs),
				new Filter("Fincode", FilterOperator.EQ, Fincode),
				new Filter("Classificazione", FilterOperator.NE, "E"),
				
			]
			modelHana.read("/NuovaAutorizzazioneSet", {
				urlParameters: {
					$expand: "AmminCompetenza"
				},
				filters: aFilters,
				success: (oData) => {
					modelPosFin.setProperty("/Auth",oData.results[0])
				},
				error: (res) => {
					MessageBox.error("Errore nel recupero dell Autorizzazione")
					// modelPosFin.setProperty("/busyAuth", false)
				}
			})
		},

		onResetValue: function(oEvent) {
			this.getView().setModel(new JSONModel([]), "modelAppoggio");
			if(isCassa){
				this.setModelTableSac(null, "Ca");
			}else{
				this.setModelTableSac(null,false);
			}

		},

		_onObjectMatched:async function (oEvent, objArgs) {

			const oKeysArgs = oEvent ? oEvent.getParameter("arguments") : objArgs;
			let modelPosFin = this.getView().getModel("modelPosFin")
			const modelHana = this.getOwnerComponent().getModel("sapHanaS2")

			await this.__getAnnoFaseProcessoMacroFase();
			await this.getAuth(oKeysArgs.Fincode, oKeysArgs.Fikrs);
			//this.resetSrc(true);		
			modelPosFin.setProperty("/AuthChoosed", oKeysArgs.Auth);
			modelPosFin.setProperty("/Esposizione", oKeysArgs.Esposizione);
			modelPosFin.setProperty("/gestioneCampiEditabili", { stato_pg: true})
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
				MaxAuthScadenza: null
			})
			this.getView().setModel(new JSONModel({quadroVisible:false}),"modelVisQuadri")
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
			this._resetModelTable()
			this.__removeDuplicateDomSStr()

			this.getView().setBusy(true)			
				return new Promise( async function(resolve, reject) {
					// let oPosFin = await this.__getPosFin()
					let oPosFin = await this.__getPosFin(`/PosizioneFinanziariaSet(Fikrs='${oKeysArgs.Fikrs}',Anno='${oKeysArgs.Anno}',Fase='${oKeysArgs.Fase}',Reale='${oKeysArgs.Reale}',Fipex='${oKeysArgs.Fipex}')`, modelHana)
					if(oPosFin.StatusPg === "1" || oPosFin.StatusPg === "0")
						this.__setVisibleFieldModifica(modelPosFin)
						modelPosFin.setProperty("/posFin", oPosFin.CodificaRepPf)
					modelPosFin.setProperty("/PosFin", oPosFin)

					//lt lock
					var sCheckLock = await this.checkLock( oPosFin);
					if (sCheckLock.bCheck === false) {			
						this.getView().setModel(new JSONModel({LOCKED:"X",MESSAGE:sCheckLock.MESSAGE}),"modelLocked");
						this.unlock = false
						this._messageBox(sCheckLock.MESSAGE, "error");
						console.log(`la proprietà unlock è: ${this.unlock} , arriva Bloccato con messaggio ${sCheckLock.MESSAGE}`);
					}else{
						this.unlock = true
						console.log(`la proprietà unlock è: ${this.unlock} , Non era bloccato e quindi viene bloccato in sessione`);
						this.getView().setModel(new JSONModel({LOCKED:"",MESSAGE:""}),"modelLocked");
					}

					let sKeyCheckSstr = `/CheckSottostrumentoSet(Fikrs='${oPosFin.Fikrs}',Anno='${oPosFin.Anno}',Fase='${oPosFin.Fase}',Reale='${oPosFin.Reale}',Eos='${oPosFin.Eos}',Prctr='${oPosFin.Prctr}',CodiceCapitolo='${oPosFin.Capitolo}')`		
					const responseCheckSottostrumentoVar = await this.__getKeyPromiseResolve(sKeyCheckSstr, modelHana)
					//const controlloSottostrumento = await this._setCheckModifiable(oSottostrumento, responseCheckSottostrumentoVar, modelPosFin)
					const controlloSottostrumento = await this._setCheckModifiable(oSottostrumento, responseCheckSottostrumentoVar, modelPosFin)
					const controlloFoglio = await this._setCheckFoglio(controlloSottostrumento, oPosFin, modelPosFin )

					
					
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
								
								if(oPosFin.StatusPg === "3")
									this.setStateAttributiPosFinDisattiva(modelPosFin, false)
								//anagrafica non modificabile se sottostrumento ha tipologia esposizione su Rimodulazione Orizzontalee
								if( modelPosFin.getProperty("/infoSottoStrumento/TipoEsposizione") === "2")
									this.__setAllFieldNotModifiable(modelPosFin, false)
								if(!controlloSottostrumento){
									this.__setAllFieldNotModifiable(modelPosFin, false, false)
								}

								if(!controlloFoglio){
									this.__setAllFieldNotModifiable(modelPosFin, false, false)
								}

								//this.setUrlContabile();
							if(oKeysArgs.Esposizione !== '9') this.showDefRim();
							if(oKeysArgs.Esposizione === '9') this.setReiscrizioni();

							}.bind(this))
							.catch(err => {
								this.getView().setBusy(false)
								let oError = JSON.parse(err.responseText)
								MessageBox.error(oError.error.message.value)
							})
				}.bind(this))
			
		},

		_setCheckFoglio: async function (controlloSottostrumento, oPosFin, modelPosFin) {

					if(!controlloSottostrumento){
							return false
					}
					//! LT controllo foglio notizie			
					const modelAmm = this.getOwnerComponent().getModel("modemAmm")		
					
					let aFilters = [
							new Filter("FIKRS", FilterOperator.EQ, oPosFin.Fikrs),
							new Filter("FASE", FilterOperator.EQ, oPosFin.Fase),
							new Filter("ANNO", FilterOperator.EQ, oPosFin.Anno),
							new Filter("CODICE_CAPITOLO", FilterOperator.EQ, oPosFin.Capitolo),
							//new Filter("CODICE_PG", FilterOperator.EQ, oPosFin.Pg),
							new Filter("VERSIONE", FilterOperator.EQ, "B"),
							new Filter("PRCTR", FilterOperator.EQ, oPosFin.Prctr),
							new Filter("DATBIS", FilterOperator.GE, this.formatter.formatterDatePatter(new Date(), 0)), 
					]
					const recPosFin = await this.__getDataPromisePerFoglio("/ZES_POSFIN_SA_SET", aFilters, modelAmm) 
					
					if(recPosFin.length === 0){
							return true
					}
					var stringDateDay = this.formatter.formatterDatePatter(new Date(), 0);
					const modelFoglioNotizie = this.getOwnerComponent().getModel("sapHanaS2FoglioNotizie")
					let filterFoglio = [
							new Filter("STATO_FN", FilterOperator.EQ, "05"),
							new Filter("NUMERO_FN", FilterOperator.EQ, recPosFin[0].REALE), //.substr(1)
							new Filter("VERSIONE", FilterOperator.EQ, 'B'),
							new Filter("EOS", FilterOperator.EQ, 'S'),
							new Filter("ANNO", FilterOperator.EQ, recPosFin[0].ANNO),
							new Filter("FIKRS", FilterOperator.EQ, recPosFin[0].FIKRS),
							new Filter("FASE", FilterOperator.EQ, recPosFin[0].FASE),
							new Filter("DATBIS", FilterOperator.GE, stringDateDay)
							//new Filter("REALE", FilterOperator.EQ, 'R'),
							//new Filter("DATBIS", FilterOperator.EQ, '99991231'),
					]
					var f = [
							new Filter("REALE", FilterOperator.EQ, "R"),
							new Filter("REALE", FilterOperator.Contains, "S"),
					]
					filterFoglio.push(new Filter(f, false));
					//lt usco l'expand altrimenti mi estra N fogli notizie
					const sExpand = { '$expand' :'NAV_POSFIN/NAV_ELENCHI,NAV_POSFIN/NAV_COFOG,NAV_POSFIN/NAV_REVUFF,NAV_POSFIN/NAV_IRAP'};
					let foglioNotizie = await this.__getDataPromisePerFoglio("/ZES_FN_PF_SET", filterFoglio , modelFoglioNotizie , sExpand)
					//let wfFn = await this.__getDataPromisePerFoglio("/ZES_WF_FNFP_SET", [new Filter("NUMERO_FN", FilterOperator.EQ, recPosFin[0].REALE)] , modelFoglioNotizie , {})

					if(foglioNotizie.length > 0) {
							modelPosFin.setProperty("/modificabile", true)
							return true
					}

					let msg = `La posizione finanziaria è presente all'interno del Foglio notizie N ${recPosFin[0].REALE.slice(1)}.\nLa posizione finanziaria non si potrà più modificare finchè il foglio notizie non verrà approvato.\nNon si potranno effettuare variazioni contabili nè di cassa nè di competenza`
					if(!recPosFin.find(el => el.FIPEX === oPosFin.Fipex)) msg = `All'interno del Foglio notizie N ${recPosFin[0].REALE.slice(1)} è presente una posizione finanziaria con lo stesso capitolo.\nLa posizione finanziaria non si potrà più modificare finchè il foglio notizie non verrà approvato.\nNon si potranno effettuare variazioni contabili nè di cassa nè di competenza`
					modelPosFin.setProperty("/modificabile", false)
					if(this.unlock) MessageBox.warning(msg)
					return false

		},

		_setCheckModifiable: async function (currentSStr, modifySStr, modelPosFin, locked) {
			const esercizio = this.getView().getModel("globalModel").getProperty("/ANNO")
			if(modifySStr !== null){
				//!lt controllo l'anno 
				if(parseInt(modifySStr.CodiceSottostrumento.slice(0,4)) < parseInt(esercizio)){
					return true
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
					return true
				}

				if(currentSStr.TipoSstr == "52" && sstrDiLavorazione['/SottostrumentoSet'].TipoSstr == "51"){
					return true
				}
				if(modifySStr.CodiceStrumento == currentSStr.CodiceStrumento && modifySStr.CodiceStrumentoOri == currentSStr.CodiceStrumentoOri &&
					modifySStr.CodiceSottostrumento == currentSStr.CodiceSottostrumento) {
						modelPosFin.setProperty("/modificabile", true)
						return true
				} else {
					modelPosFin.setProperty("/modificabile", false)
					//if(this.unlock) MessageBox.warning(`Il capitolo della posizione finanziaria selezionata è stato già modificato anagraficamente dal sottostrumento ${sstrDiLavorazione['/SottostrumentoSet'].DescTipoSstr} - ${sstrDiLavorazione['/SottostrumentoSet'].NumeroSstr}`)
					return false
				}
			} else {
				modelPosFin.setProperty("/modificabile", true)
				return true
			}
		},
		
		_getSingleAutorizzazione: function () {
			let modelHana = this.getOwnerComponent().getModel("sapHanaS2")
			let modelPosFin = this.getView().getModel("modelPosFin")
			const authChoosed = modelPosFin.getProperty("/AuthChoosed")
			let aFilters = [
				new Filter("Fikrs", FilterOperator.EQ, modelPosFin.getProperty("/PosFin/Fikrs")),
				new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/PosFin/Anno")),
				new Filter("Fase", FilterOperator.EQ,modelPosFin.getProperty("/PosFin/Fase")),
				new Filter("Reale", FilterOperator.EQ,modelPosFin.getProperty("/PosFin/Reale")),
				new Filter("Fipex", FilterOperator.EQ,modelPosFin.getProperty("/PosFin/Fipex")),
				new Filter("Classificazione", FilterOperator.NE, "E")
				]
				if(modelPosFin.getProperty("/Esposizione") === "9") aFilters.push(new Filter("IdAutorizzazione", FilterOperator.EQ, authChoosed))
			
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
				},
				error: (res) => {					
				}
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
								new Filter("Reale", FilterOperator.EQ, oPosFin.Reale), //lt inserisco Reale da pos fin
							]
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
								new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
								new Filter("Pg", FilterOperator.EQ, oPosFin.Pg),
								new Filter("Eos", FilterOperator.EQ, "S")
							]
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
								new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
								new Filter("CodiceStd", FilterOperator.EQ, oCapitolo[sPath])
							]
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

			// create popovers
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
			let modelPosFin = this.getView().getModel("modelPosFin")
			const esposizione = modelPosFin.getProperty("/Esposizione");
			this.getView().setModel(new JSONModel({quadroVisible:false}),"modelVisQuadri")
			switch (oEvent.getParameter("key")) {
				case "info":
					break;
				case "Contabile":
					this._resetModelTable()
					if(esposizione !== "9") this.showDefRim()	
					if(esposizione === "9") this.setReiscrizioni()	
					break;
				default:
					break;
			}

			var boolInfo = true;
			oEvent.getParameter("key") === "info" ? boolInfo = true : boolInfo = false;

			modelPosFin.setProperty("/tabAnagrafica", boolInfo)

		},

		setReiscrizioni: async function () {
				this.popolateModelFilter();
				//this.getView().setBusy(true);
				this.getView().setModel(new JSONModel({}),"modelPluri")
				let modelPosFin = this.getView().getModel("modelPosFin")
				const oPosFin = modelPosFin.getProperty("/PosFin")
				var oEsposizione = modelPosFin.getProperty("/infoSottoStrumento");
				var sAuth = modelPosFin.getProperty("/AuthChoosed");
				var oAuth = modelPosFin.getProperty("/Auth");
				var sFictr = modelPosFin.getProperty("/CompetenzaAuth").Auth.Fictr;
				const oModelQuadroReis = this.getOwnerComponent().getModel("modelSHReiscrizioni")

				await Promise.all([
					this.reiscrizioniTab1(sAuth),
					this.reiscrizioniTab2(oPosFin.Fipex, sAuth),
					this.reiscrizioniTab3(oPosFin.Fipex, sAuth, sFictr),
					this.reiscrizioniTab4(oPosFin.Fipex, sAuth, sFictr, oPosFin),
				])
					.then(function (res) {
						this.getView().setBusy(false);
					}.bind(this))
					.catch(err => {
						this.getView().setBusy(false);
						let oError = JSON.parse(err.responseText)
						MessageBox.error(oError.error.message.value)
					})

		},

		reiscrizioniTab1: function (sAuth) {
			const oModelQuadroReis = this.getOwnerComponent().getModel("modelSHReiscrizioni")

			var that = this;
			var sAnno = this.getOwnerComponent().getModel("globalModel").getData().ANNO;
			return new Promise((resolve, reject) => {
															//ZCOBI_I_SIT_AUT_CONS_01(P_AreaFin='S001',P_Fase='NV',P_AnnoFase='2025',P_Autorizz=' ')/Set?sap-client=100
				oModelQuadroReis.read("/ZCOBI_I_SIT_AUT_CONS_01(P_AreaFin='S001',P_Fase='NV',P_AnnoFase='" + sAnno + "',P_Autorizz='" + sAuth + "')/Set", {

					success: (oData) => {
						//debugger
						this.formatterImporti(oData.results, false, "ImportoDaReiscrivere");
						that.getView().setModel(new JSONModel(oData.results), "modelTableRes")

						resolve()
					},
					error: (err) => {
						//debugger
						resolve(err)
					}
				})
			})
		},
		reiscrizioniTab2: function (sFipex, sAuth) {
			const oModelQuadroReis = this.getOwnerComponent().getModel("modelSHReiscrizioni")

			var that = this;
			return new Promise((resolve, reject) => {
														 
				oModelQuadroReis.read("/ZCOBI_I_SIT_AUT_CONS_02(P_PosFin='" + sFipex.replaceAll(".", "") + "',P_Autorizz='" + sAuth + "')/Set", {

					success: (oData) => {
						//debugger
						var o = [{
							Label: "Economie da reiscrivere per autorizzazione",
							Importo: oData.results[0].EconDaReiscPerAutorizz
						},
						{
							Label: "Economie reiscritte per autorizzazione",
							Importo: oData.results[0].EconReiscrittePerAutorizz
						},
						{
							Label: "Economie reiscritte per PosFin/Autorizzazione",
							Importo: oData.results[0].EconReiscrittePerCB
						},
						{
							Label: "Economie ancora da riscrivere",
							Importo: oData.results[0].EconAncoraDaReiscrivere
						}];

						this.formatterImporti(o, false, "Importo");
						that.getView().setModel(new JSONModel(o), "modelTableRes2")

						resolve()
					},
					error: (err) => {
						//debugger
						resolve(err)
					}
				})
			})
		},
		reiscrizioniTab3: function (sFipex, sAuth, sFictr) {
			const oModelQuadroReis = this.getOwnerComponent().getModel("modelSHReiscrizioni")
			var sAnno = this.getOwnerComponent().getModel("globalModel").getData().ANNO;
			var that = this;
			var aFilters = [];
			aFilters.push(new sap.ui.model.Filter("RecordType", sap.ui.model.FilterOperator.EQ, "CP"));
			return new Promise((resolve, reject) => {

														///ZCOBI_I_SIT_AUT_CONS_05(P_AreaFin='S001',P_AnnoFase='2025',P_Fase='NV',P_PosFin=' ',P_Autorizz=' ')/Set?sap-client=100
				//oModelQuadroReis.read("/ZCOBI_I_SIT_AUT_CONS_05(P_Anno1='" + sAnno + "',P_Anno2='" + (parseInt(sAnno) + 1) + "',P_Anno3='" + (parseInt(sAnno) + 2) + "',P_AreaFin='S001',P_AnnoFase='" + sAnno + "',P_Fase='NV',P_PosFin='" + sFipex.replaceAll(".", "") + "',P_Autorizz='" + sAuth + "')/Set", {
				oModelQuadroReis.read(`/SitAutoCons03(P_Anno1='${sAnno}',P_Anno2='${(parseInt(sAnno) + 1)}',P_Anno3='${(parseInt(sAnno) + 2)}',P_AreaFin='S001',P_AnnoFase='${sAnno}',P_Fase='NV',P_PosFin='${sFipex}',P_Autorizz='${sAuth}')/Set`, {

					success: (oData) => {


						oData.results.sort((a,b) => (parseInt(a.ANNO_MOV) > parseInt(b.ANNO_MOV)) ? 1 : ((parseInt(b.ANNO_MOV) > parseInt(a.ANNO_MOV)) ? -1 : 0))
						var aResults = [];
						for (var i = 0; i < oData.results.length; i++) {

							switch(oData.results[i].Voice){
								case 'Reiscrizionischeda':
									oData.results[i].Voice="Reiscrizioni di competenza pervenute con scheda"
									oData.results[i].Input = false;
									oData.results[i].Text = true;
									break;

								case 'Reiscrizionirevisioni':
									oData.results[i].Voice="Reiscrizioni di competenza in revisione"
									oData.results[i].Input = false;
									oData.results[i].Text = true;
								break;					
								case 'Totalereiscrizioni':
									oData.results[i].Voice="Totale Reiscrizioni economie"
									oData.results[i].Input = false;
									oData.results[i].Text = true;
								break
								case 'ReiscrizioniDLB':
									oData.results[i].Voice="Reiscrizioni DLB"
									oData.results[i].Input = false;
									oData.results[i].Text = true;
								break
								case 'ReiscrizioniNota':
									oData.results[i].Voice="Reiscrizioni Nota"
									oData.results[i].Input = false;
									oData.results[i].Text = true;
								break
								case 'DiCuiNotaProvv':
									oData.results[i].Voice="Di Cui Nota Provvisoria"
									oData.results[i].Input = false;
									oData.results[i].Text = true;
								break
								case 'DiCuiNotaPubbl':
									oData.results[i].Voice="Di Cui Nota Pubblicata"
									oData.results[i].Input = false;
									oData.results[i].Text = true;
								break
								case 'Variazioni':
									oData.results[i].Voice="Variazioni"
									oData.results[i].Input = true;
									oData.results[i].Text = false;
								break

							}
						
							
						}
						
						that.getView().setModel(new JSONModel({ anno1: sAnno, anno2: parseInt(sAnno) + 1, anno3: parseInt(sAnno) + 2 }), "modelYearRes")
							
							oData.results.push({
								"AreaFin": "S001",
								"AnnoFase": "2025",
								"Fase": "NV",
								"Voice": "Variazioni",
								"ImportoAnno1": "0,00",
								"ImportoAnno2": "0,00",
								"ImportoAnno3": "0,00",
								"Currency": "EUR",
								"Input"	: true,
								"Text"	: false,
								"AllineaCassa" : false,
								"ANNO1" : parseInt(sAnno) ,
								"ANNO2" : parseInt(sAnno) + 1,
								"ANNO3" : parseInt(sAnno) + 2,
							})
						that.getView().setModel(new JSONModel(oData.results), "modelTableRes3")
						that.getView().setModel(new JSONModel({AllineaCassa : false}), "modelPayload")


						resolve()
					},
					error: (err) => {
						//debugger
						resolve(err)
					}
				})
			})
		},

		reiscrizioniTab4: async function (fipex, sAuth, sFictr, oPosFin) {
				//const exp = isForExport === true ? "Exp" : ""
				//let rowSelected = oEvent.getSource().getBindingContext(modelFrom).getObject()
				var modelFilter = this.getView().getModel("modelFilter");
				var modelFilterData = modelFilter.getData()
				

				let oModelQuadro = this.getOwnerComponent().getModel("ZSS4_COBI_QUADRO_CONTABILE_DLB_SRV")
				//! LT 20241028 -> NON USO IL MODELLO NV PERFCHè NON HA L'ENTITY PRESENTE. BASTA USARE QUELLO DI DLB PASSANO NV COME FASE 
				//let oModelQuadro = this.getOwnerComponent().getModel("ZSS4_COBI_QUADRO_CONTABILE_SRV")
				//let sFase = this.getQCFase();
				let oModelPosFin = this.getView().getModel("modelPosFin");
				let sAnno = this.getOwnerComponent().getModel("globalModel").getData().ANNO;
				//let oAut = oModelPosFin.getProperty("/CompetenzaAuth");
							
						

				var sEntityCs,sEntityCp;
						sEntityCp = `/ZCOBI_I_SSTR_DAL_AL(P_AnnoFase='${sAnno}',P_Fase='NV',P_Sstr='${modelFilterData.sStrumento}',P_Str='${modelFilterData.strumento}',P_Str_ori='${modelFilterData.strumentoOr}',P_StruttAmm='${sFictr}',P_PosFin='${fipex}',P_Autorizz='${sAuth}')/Set?`
						sEntityCs = `/ZCOBI_I_SSTR_DAL_AL(P_AnnoFase='${sAnno}',P_Fase='NV',P_Sstr='${modelFilterData.sStrumento}',P_Str='${modelFilterData.strumento}',P_Str_ori='${modelFilterData.strumentoOr}',P_StruttAmm='${sFictr}',P_PosFin='${fipex}',P_Autorizz='')/Set?`
								
						this.getView().setModel(new JSONModel([{}]), `mTableQuadroDal`);
						this.getView().setModel(new JSONModel([{}]), `mTableQuadroDalCs`);
		
								var aReqDalAlCp = await this.__getDataPromise(sEntityCp, [], oModelQuadro);
								this.formatterImporti(aReqDalAlCp, false, "Importo")
								aReqDalAlCp = aReqDalAlCp.filter(el => el.RecordType === "CP")

								this.getView().setModel(new JSONModel(aReqDalAlCp), `mTableQuadroDal`);
		
								var aReqDalAlCs = await this.__getDataPromise(sEntityCs, [], oModelQuadro);
								this.formatterImporti(aReqDalAlCs, false, "Importo")
								this.getView().setModel(new JSONModel(aReqDalAlCs), `mTableQuadroDalCs`);
					return true

		},

		onSaveReiscrizioni: async function(oEvent) {
			const oModelVarCont = this.getOwnerComponent().getModel("modemVarCont")
			try {
				var oPayload = this.createPayloadRei(false)				
			} catch (error) {
				MessageBox.error("Errore nella creazione del payload di scrittura")
				console.log("Log errore creazione payload reiscrizioni",error)
				return
			}


			const modelPayloadData = this.getView().getModel("modelPayload").getData()

			let msg = !modelPayloadData.AllineaCassa ? this.recuperaTestoI18n("confermaSalvataggioCassaWarning") : this.recuperaTestoI18n("confermaSalvataggio");
			//se rimodulazioni orizzontali controllo che la somma di tutti i valori diano 0 altrimenti do errore
			
			if(!oPayload){
				return
			}

			//! LT -> mando i $ nell'oData per imputare i dati
			console.log(oPayload)
			MessageBox.show(
				msg, {
					icon: MessageBox.Icon.INFORMATION,
					title: "Salvataggio ",
					actions: [MessageBox.Action.YES, MessageBox.Action.NO],
					emphasizedAction: MessageBox.Action.YES,
					onClose:async function  (oAction) { 
						if(oAction === "YES"){
							
							//!lt controllo i tre anni e il modello pluri
							sap.ui.core.BusyIndicator.show();	
							var path ="/Variazioni_ContabiliSet"
							const invio  = await this.__setDataPromiseSaveBW( path ,oModelVarCont, {}, oPayload)		
							sap.ui.core.BusyIndicator.hide()
							if(invio.success) {
								MessageBox.success("Operazione eseguita con successo")
								this.setReiscrizioni()	
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

		createPayloadRei: function(isCassa){
			const modelPayload = this.getView().getModel("modelPayload")
			var modelPayloadData = modelPayload.getData()
			const modelTableRes3 = this.getView().getModel("modelTableRes3")
			var data = modelTableRes3.getData()
			var rowTriennio = data[data.length -1]

			const flagADecorrere = false
			const allineaCassa = modelPayloadData.AllineaCassa
			var oPayload = this.entryRei(true, {
				Decorrere : flagADecorrere,
				AllineaCassa : allineaCassa
			}, isCassa)
			var somma = 0
			
			for (let i = 1; i <= 3; i++) {
				if(rowTriennio[`ImportoAnno${i}`] === "0,00") continue
				//controllo che non sia = a 0 altrimenti non lo creo
				let valore = parseInt(rowTriennio[`ImportoAnno${i}`].replace(",00","").replaceAll(".", ""))
				var valori = {
					Importo : rowTriennio[`ImportoAnno${i}`].replace(",00","").replaceAll(".", ""),
					AnnoDa : rowTriennio[`ANNO${i}`].toString(),
					AnnoA : "",
					Decorrere : false,
					AllineaCassa : allineaCassa
				}
				var payload = this.entryRei(false, valori, isCassa)
				oPayload.UPDATEDEEPVARIAZIONI.push(payload)
				somma = somma + valore
			}

				
				var modelPluri = this.getView().getModel("modelPluri");
				var modelPluriData = modelPluri.getData()

				//! lt gestisto la popup dei plurienni
				if(modelPluriData){

					if(modelPluriData.annoSing){
						var singoloRecord = {
							Importo : el.importo.replace(",00","").replaceAll(".", ""),
							AnnoDa : el.annoDal,
							Decorrere : flagADecorrere,
							AllineaCassa : allineaCassa
						}
						oPayload.UPDATEDEEPVARIAZIONI.push(this.entryRei(false, singoloRecord, isCassa))
					}
					//creo il singolo anno dei pluriennali
					if(modelPluriData &&  modelPluriData.NAV_PLUR && modelPluriData.NAV_PLUR.length > 0){
						//lt trovo tutti i record con un anno dal al valorizzato
						let recordDaInviare = modelPluriData.NAV_PLUR.filter(row => row.annoDal !== "" && row.annoAl !== "")
						recordDaInviare.forEach(row => {
							//!sommo anche i record dal al
							if(row.annoAl){
								//prendo gli anni dal al e faccio 
								let annoDa = parseInt(row.annoDal)
								let annoA = parseInt(row.annoAl)
								let ricorrenza = parseInt(row.ricorrenza) 
								if((annoDa - annoA) === 0) {
									somma = somma + parseInt(row.importo.replaceAll(".",""))
								}else{
									//lt calcolo l'intervallo degli anni
										if(ricorrenza === 0) ricorrenza = 1
										//!lt creo per ogni anno dei pluriennali le righe
										for (let z = annoDa; z <= annoA; z ) {
											somma = somma + parseInt(row.importo.replaceAll(".",""))
											z = z + ricorrenza
										}
								} 
							
							var recordPluri = {
								Importo : row.importo.replace(",00","").replaceAll(".", ""),
								AnnoDa : row.annoDal,
								AnnoA : row.annoAl,
								Ricorrenza : row.ricorrenza,
								Decorrere : flagADecorrere,
								// AllineaCassa : rowTriennio.FLAG_ALLINEA_CS
								AllineaCassa : allineaCassa
							}
							oPayload.UPDATEDEEPVARIAZIONI.push(this.entryRei(false, recordPluri, isCassa))
						}
						});
					}					
				}

				if(oPayload.UPDATEDEEPVARIAZIONI.length === 0){
					MessageBox.warning("Non ci sono valori da imputare")
					return false
				}

				const modelTableRes2 = this.getView().getModel("modelTableRes2")
				const modelTable2Data = modelTableRes2.getData()

				let indexRow = modelTable2Data.length -1

				let importoMax = parseInt(modelTable2Data[indexRow].Importo.replace(",00", "").replaceAll(".", ""))
				
				if(somma > importoMax){
					MessageBox.warning(`L'importo inserito è maggiore dell'importo da reiscrivere (${modelTable2Data[indexRow].Importo})`)
					return false
				}

				return oPayload
			
		},

		entryRei: function(isTestata, valori, isCassa){
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
				"Fincodecoll" :modelFilterData.autColl,
				"Fincode" : modelFilterData.fincode,
				"Importo" : !valori.Importo ? "0" : valori.Importo,
				"CodiceStrumento" : modelFilterData.strumento,
				"CodiceStrumentoOri" : modelFilterData.strumentoOr,
				"CodiceSottostrumento" : modelFilterData.sStrumento,
				"AnnoDa" : !valori.AnnoDa ? "" : valori.AnnoDa,
				"AnnoA" : !valori.AnnoA ? "" : valori.AnnoA,
				"Capitolo" : posFin.Capitolo,
				"Eos" : modelFilterData.eos
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

		setUrlContabile: async function () {
			let that = this;
			const modelPosFin = this.getView().getModel("modelPosFin")
			const oPosFin = modelPosFin.getProperty("/PosFin")
			var oEsposizione = modelPosFin.getProperty("/infoSottoStrumento");
			var sAuth = modelPosFin.getProperty("/AuthChoosed");
			var oAuth = modelPosFin.getProperty("/Auth");
			const oModelHana = this.getOwnerComponent().getModel("sapHanaS2")
			var sAttivo = "1";
			var oModelRuolo = this.getOwnerComponent().getModel("userRoleModel")
			var sRuolo = "";
			try {
				sRuolo = oModelRuolo.getProperty("/role/0")
			} catch (error) {
				
			}
			var modelHana = this.getOwnerComponent().getModel("sapHanaS2Revisione");
			const sEsposizione = modelPosFin.getProperty("/infoSottoStrumento/TipoEsposizione");
			var sSemObj = "GEST_POSFIN";
			var oMapSchedaSac = {
				"5": "RIFINANZIAMENTI",
				"6": "DEFINANZIAMENTI",
				"7": "RIPROGRAMMAZIONE",
				"9": "REISCRIZIONI"
			}
			if (sEsposizione !== "9") {
				const aCheckRuolo = await this.__getDataPromise("/CHECK_ENTITY_RUOLOSet",
									[
										new Filter("Attore", FilterOperator.EQ, sRuolo),
										new Filter("IdControllo", FilterOperator.EQ, "00001"),
										new Filter("TypeKey", FilterOperator.EQ, "GEST_POSFIN"),
										new Filter("Ambito", FilterOperator.EQ, "SPESA"),
										new Filter("Schermata", FilterOperator.EQ, oMapSchedaSac[sEsposizione])
								], oModelHana);
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
			var sSchermata = oMapSchedaSac[sEsposizione];
			if (["5","6","9"].includes(sEsposizione)) {
					BusyIndicator.hide();
			} 
			
			
		},

		showDefRim: async function (oEvent,isForExport) {
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
				const sEsposizione = oModelPosFin.getProperty("/infoSottoStrumento/TipoEsposizione");
				
				var oMapSchedaSac = {
					"5": "RIFINANZIAMENTI", //RIF_COMPETENZA
					"6": "DEFINANZIAMENTI", //DIF_COMPETENZA
					"7": "RIPROGRAMMAZIONE", //RIP_COMPETENZA
					"9": "REISCRIZIONI" // da definire
				}

				let schermata;

				switch (sEsposizione) {
					case "5":
						schermata = "RIF_COMPETENZA"
						break;
				
					case "6":
						schermata = "DEF_COMPETENZA"
						break;
				
					case "9":
						schermata = "RIF_COMPETENZA"
						break;
				
					default:
						break;
				}

				var controllo = {
					"Fincode" : modelFilter.fincode,
					"IDcontrollo" : "00191", //DA MODIFICARE IN BASE ALLE INFO DEI CONTROLLI 00191
					"TypeKey" : "GEST_POSFIN",
					"Fikrs" : "S001",
					"CodiceStrumento" : modelFilter.strumento,
					"CodiceSottostrumento" : modelFilter.sStrumento,
					"CodiceStrumentoori" : modelFilter.strumentoOr,
					"Schermata" : schermata, //DA MODIFICARE IN BASE ALLE INFO DEI CONTROLLI RIP REF DIF _COMPETENZA
					"Ambito" : "SPESA",
					"VERSIONE" : datiPerControllo.Versione,
					"ANNO" : datiPerControllo.Anno,
					"REALE" : datiPerControllo.Reale,
					"FIPEX" : datiPerControllo.Fipex,
					"FICTR" : struttura.Fictr 
				}

				
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
					//modelVisQuadri.setProperty('/Attivo' , true)
	
				
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
			
			
			// const oModelQuadro = this.getOwnerComponent().getModel("ZSS4_COBI_QUADRO_CONTABILE_DLB_SRV")
			const oModelQuadro = this.getOwnerComponent().getModel("ZSS4_COBI_QUADRO_CONTABILE_SRV")
			let sAnno = this.getOwnerComponent().getModel("globalModel").getData().ANNO;
			var sEntity =
				`/QuadroContabile(P_Disp=true,P_AreaFin='S001',P_AnnoFase='${modelFilter.keyAnno}',P_AnnoMin='${modelFilter.keyAnno}',P_AnnoMax='${modelFilter.keyAnno + 2}',P_Fase='NV',P_Eos='S',P_PosFin='${modelFilter.posfin}',P_Autorizz='${modelFilter.fincode}',P_Capitolo='${modelFilter.codCap}',P_RecordType='CB')/Set`;
			//var sEntity = "/QuadroContabile(P_Disp=true,P_AreaFin='S001',P_AnnoFase='" + sAnno + "',P_AnnoMin='" + sAnno + "',P_AnnoMax='" + (parseInt(sAnno) + 2) + "',P_Fase='NV',P_Eos='S',P_PosFin='" + oModelPosFin.getProperty("/posFin").replaceAll(".", "") + "',P_Autorizz='" + oAut.Auth.IdAutorizzazione + "',P_Capitolo='" + oModelPosFin.getProperty("/PosFin/Capitolo") + "',P_RecordType='CB')/Set"
			var aRes = await this.__getDataPromise(sEntity, [], oModelQuadro);
			this.formatterImporti(aRes, true)
			this.splitTable(aRes, "COMP", `modelTable`, isForExport);
			this.getView().setModel(new JSONModel([]), `modelAppoggio`);
			this.setModelSelect();
			this.setModelTableSac(null,false,isForExport);

			this.getView().setModel(new JSONModel([]), "modelAppoggio");
			
			//this.byId("toolbarQuadro").setVisible(true);
			//var sEntityDA = "/ZCOBI_I_QC_DAL_AL(P_AnnoFase='" + sAnno + "',P_AnnoStr='" + sAnno + "',P_AnnoSstr='" + (parseInt(sAnno) + 2) + "',P_PosFin='" + oModelPosFin.getProperty("/posFin").replaceAll(".", "") + "',P_Autorizz='',P_StruttAmm='" + oModelPosFin.getProperty("/strutturaAmminCentrale").Fictr + "')/Set";
			var sEntityDA = "/ZCOBI_I_QC_DAL_AL(P_AnnoFase='" + sAnno + "',P_AnnoStr='" + sAnno + "',P_AnnoSstr='" + (parseInt(sAnno) + 2) + "',P_PosFin='" + modelFilter.posfin + "',P_Autorizz='" + modelFilter.fincode + "',P_StruttAmm='" + modelFilter.struttAmm + "')/Set";
			var aFilters = [];
			aFilters.push(new sap.ui.model.Filter("RecordType", sap.ui.model.FilterOperator.EQ, "CP"));
			var aRes = await this.__getDataPromise(sEntityDA, aFilters, oModelQuadro);
			this.formatterImporti(aRes, false, "Importo")
			aRes = aRes.sort(
				(a, b) => parseInt(a.YearLow) - parseInt(b.YearLow)
			);
			this.getView().setModel(new JSONModel(aRes), `modelTableComp${exp}`);
			
			this.getView().setBusy(false)
			if(!isForExport){
				this.getView().getModel("modelVisQuadri").setProperty("/quadroVisible" , true)
			}
		},

		popolateModelFilter: function() {

			let modelPosFin = this.getView().getModel("modelPosFin")
			let modelData = modelPosFin.getData()
			let posFin = modelPosFin.getProperty("/PosFin")
			let auth = modelPosFin.getProperty("/Auth")		
			let onAuthCollegata = modelPosFin.getProperty("/CompetenzaAuth/AuthAssociata")		
			let sottostrumento = modelPosFin.getProperty("/infoSottoStrumento")	
			let strutturaAmminCentrale = modelPosFin.getProperty("/strutturaAmminCentrale")	
			var oFilter = {
				eos: posFin.Eos,
				posfin: posFin.Fipex,
				fincode: auth ? auth.Fincode : "",
				autColl: onAuthCollegata ? onAuthCollegata.SeqFondoLe : "",
				struttAmm:  strutturaAmminCentrale.Fictr , //auth ? auth.Fictr : "",
				prctr: posFin.Prctr,
				codCap: posFin.Capitolo,
				strumento:sottostrumento.CodiceStrumento,
				sStrumento: sottostrumento.CodiceSottostrumento,
				strumentoOr: sottostrumento.CodiceStrumentoOri,
				codCdr: "",//strutturaAmminCentrale.CodiceCdr
				keyAnno: parseInt(this.getView().getModel("globalModel").getProperty("/ANNO")),
			}
			this.getView().setModel(new JSONModel(oFilter), "modelFilter");
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
				new Filter("Reale", FilterOperator.EQ,  modelPosFin.getProperty("/infoSottoStrumento/Reale")),
				new Filter("Prctr", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE")),
				
			]
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
			modelHana.read("/CofogSet", {
				filters: [
					new Filter("Fikrs", FilterOperator.EQ, "S001"),
					new Filter("Fase", FilterOperator.EQ, "NV"),
					new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
					new Filter("Reale", FilterOperator.EQ,  modelPosFin.getProperty("/infoSottoStrumento/Reale")),
					new Filter("Prctr", FilterOperator.EQ, modelPosFin.getProperty("/detailAnagrafica/AMMINISTAZIONE"))
				], 
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
			oRouter.navTo("Finanziamento", {
				Fikrs: modelPosFin.getProperty("/infoSottoStrumento/Fikrs"),
				CodiceStrumento: modelPosFin.getProperty("/infoSottoStrumento/CodiceStrumento"),
				CodiceStrumentoOri: modelPosFin.getProperty("/infoSottoStrumento/CodiceStrumentoOri"),
				CodiceSottostrumento: modelPosFin.getProperty("/infoSottoStrumento/CodiceSottostrumento"),
				Datbis: modelPosFin.getProperty("/infoSottoStrumento/Datbis").toISOString(),
			});	
		},

	});
});