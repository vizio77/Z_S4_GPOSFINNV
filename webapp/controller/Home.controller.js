sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/core/Fragment",
    "./BaseController",
    "sap/m/MessageBox"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, JSONModel, Filter, FilterOperator, Fragment, BaseController, MessageBox) {
        "use strict";

        return BaseController.extend("zsap.com.r3.cobi.s4.gestposfinnv.controller.Home", {
            onInit: async function () {
                
                this.getView().setBusy(true,0)
                this.initModel();
                var oRouter = this.getOwnerComponent().getRouter();
                this.getOwnerComponent().getRouter().getRoute("Home").attachPatternMatched(function () {
				
                    this.initModel();
    
                }.bind(this), this);
                
            },

            initModel: async function(){
                const annoFase = await this.__getAnnoFaseProcessoMacroFase();
                this.getView().setModel(new JSONModel({formSottostrumento:{
                    tipologia: null,
                    tipologieSet: [],
                    codice_sstr: null,
                    esposizione_contabileSet: [],
                    esposizione_contabile: null,
                    descrizione_sstr: null,
                    visibilitaSet: [],
                    visibilita: null,
                    dominio_sstrSet: [],
                    dominio_sstr: [],
                    azione_set: [],
                    azioni: [],
                    programmi: [],
                    missioni: [],
                    economica3: [],
                    economica2: [],
                    categoria: [],
                    titoli: [],
                    auth_giust: null,
                    stato: "",
                    amministrazioni: [],
                    solo_struttura: false,
                    solo_contabili: false,
                    nessuna_restrizione: true,
                    var_struttura: false,
                    var_contabili: false,
                    OI: false,
                    FB: false,
                    FL: false,
                    esercizio: annoFase.ANNO,
                    processo: annoFase.DDTEXT,
                    macroFase: annoFase.STAT_FASE
                }}), "modelHome")
                this.getView().setBusy(false,0);
                this.getView().byId("idSstr").setEnabled(false);
            },
            onHelpValueSottoStrumento: function () {
                if(!this.oDialogHVSottoStrumento) {
                    Fragment.load({
                        name:"zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.HelpValueSottostrumento",
                        controller: this
                    }).then(oDialog => {
                        this.oDialogHVSottoStrumento = oDialog;
                        this.getView().addDependent(oDialog);
                        this.oDialogHVSottoStrumento.setBusy(true)
                        this.oDialogHVSottoStrumento.open();
                        let oModel = this.getOwnerComponent().getModel("sapHanaS2");
                        let modelHome = this.getView().getModel("modelHome")
                        this.initDataDomSStr()

                        //oModel.read("/Gest_PosFin_SH_AmministrazioniSet",{
                        oModel.read("/TipAmministrazioneSet",{
                            filters:[new Filter("Fikrs", FilterOperator.EQ, "S001"),
                                     new Filter("Anno", FilterOperator.EQ, modelHome.getProperty("/formSottostrumento/esercizio")),
                                     new Filter("Fase", FilterOperator.EQ, "NV"),
                                    new Filter("Reale", FilterOperator.EQ, "R")],
                            success:  (oData) => {
                                modelHome.setProperty("/formSottostrumento/dominio_sstrSet", oData.results.filter(el => el.Prctr !== "S000"))
                            }
                        })
                        oModel.read("/TipologiaEsposizioneVisibilitaSet",{
                            filters:[new Filter("Anno", FilterOperator.EQ,  modelHome.getProperty("/formSottostrumento/esercizio")),
                                    new Filter("Fase", FilterOperator.EQ, "NV"),
                                    new Filter("Fikrs", FilterOperator.EQ, "S001"),
                                    new Filter({
                                        filters:[ new Filter("Tipologia", FilterOperator.NE, "83"),
                                                  new Filter("Tipologia", FilterOperator.NE, "53"),
                                                  new Filter("Tipologia", FilterOperator.NE, "51"),
                                                  new Filter("Tipologia", FilterOperator.EQ, "54"),
                                                  new Filter("Esposizione", FilterOperator.NE, "E")
                                                ],
                                        and: true
                                    })
                                ],
                            success:  (oData) => {
                                //debugger
                                //Lista Tipologie
                                let aTipologia = this.__removeDuplicate(oData.results, "tipologia")
                                aTipologia.unshift({Esposizione: null, DescrEsposizione: "", Fase: null, Anno: null})
                                modelHome.setProperty("/formSottostrumento/tipologieSet", aTipologia)
                                
                                //! 20241105 -> autosetto la visualizzazione del tipo sottostrumento
                                let tipologiaStrumento = modelHome.getProperty("/infoStrumento/TipoStr")
                                //controllo che ci sia nella tipologia la lista. se esiste allora la setto altrimenti la setto vuota
                                let tipoSottoStrumentoPresente = aTipologia.find((el)=> el.Tipologia === tipologiaStrumento)
                                modelHome.setProperty("/formSottostrumento/tipologia", !tipoSottoStrumentoPresente ? "" : tipoSottoStrumentoPresente.Tipologia)

                                let aEsposizioneContabile = this.__removeDuplicate(oData.results, "esposizione")
                                aEsposizioneContabile = aEsposizioneContabile.filter(ec => ec.DescrEsposizione !== "")
                              
                                aEsposizioneContabile.unshift({Esposizione: null, DescrEsposizione: "", Fase: null, Anno: null})
                                modelHome.setProperty("/formSottostrumento/esposizione_contabileSet", aEsposizioneContabile)
                                // oData.results[0].ToSHEsposizione.results.unshift({TipoEsposizione: null, TipoEsposizioneDescr: "", Fase: null, Anno: null})
                                // modelHome.setProperty("/formSottostrumento/esposizione_contabileSet", oData.results[0].ToSHEsposizione.results)
                                //Lista Visibilità
                                let aVisibilita = this.__removeDuplicate(oData.results, "visibilita")
                                aVisibilita.unshift({Reale: null, DescrReale: "", Fase: null, Anno: null})
                                modelHome.setProperty("/formSottostrumento/visibilitaSet", aVisibilita)

                                this.oDialogHVSottoStrumento.setBusy(false)
                                // oData.results[0].ToSHVisibilita.results.unshift({Fase: null, Anno: null})
                                // modelHome.setProperty("/formSottostrumento/visibilitaSet", oData.results[0].ToSHVisibilita.results)
                            },
                            error:  (res) => {
                                this.oDialogHVSottoStrumento.setBusy(false)
                            }
                        })
                    })
                } else {
                    this.oDialogHVSottoStrumento.open();
                }
            },
            onClose: function (oEvent) {
                let customDataTableSStr= oEvent.getSource().getCustomData().find(item => item.getKey() === "TableSStr")
                if(customDataTableSStr === undefined)
                    this.__resetFiltri()
                let sDialog = oEvent.getSource().getCustomData().find(item => item.getKey() === "HVSottostrumento").getValue()
                this[sDialog].close()
                this[sDialog].destroy()
                this[sDialog] = null
            },
            __resetFiltri: function () {
                let modelHome = this.getView().getModel("modelHome");
                modelHome.setProperty("/formSottostrumento/tipologia", null)
                modelHome.setProperty("/formSottostrumento/codice_sstr", null)
                modelHome.setProperty("/formSottostrumento/descrizione_sstr", null)
                modelHome.setProperty("/formSottostrumento/visibilita", null)
                modelHome.setProperty("/formSottostrumento/dominio_sstr", null)
                modelHome.setProperty("/formSottostrumento/esposizione_contabile", null)
                modelHome.setProperty("/formSottostrumento/categoria", [])
                modelHome.setProperty("/formSottostrumento/economica2", [])
                modelHome.setProperty("/formSottostrumento/economica3", [])
                modelHome.setProperty("/formSottostrumento/programmi", [])
                modelHome.setProperty("/formSottostrumento/azioni", [])
                modelHome.setProperty("/formSottostrumento/dominio_sstr", [])
                modelHome.setProperty("/formSottostrumento/titoli", [])
                modelHome.setProperty("/formSottostrumento/missioni", [])
                modelHome.setProperty("/formSottostrumento/FL", false)
                modelHome.setProperty("/formSottostrumento/FB", false)
                modelHome.setProperty("/formSottostrumento/OI", false)
                modelHome.setProperty("/formSottostrumento/var_contabili", false)
                modelHome.setProperty("/formSottostrumento/var_struttura", false)
                modelHome.setProperty("/formSottostrumento/auth_giust", null)
                modelHome.setProperty("/formSottostrumento/stato", "")
                // this.getView().getModel("autorizzazioneGiustificativaModel").setProperty("/FINCODE", {})
                // this.getView().getModel("autorizzazioneGiustificativaModel").setProperty("/SEQ_AUT", {})

                
            },
            onPressConfSottoStrumento: function (oEvent) {
                this.onSearchSottostrumento()
            },
            onSearchSottostrumento: function() {
                var oModel = this.getOwnerComponent().getModel("sapHanaS2");
                let modelHome = this.getView().getModel("modelHome")
                    // let oAuthGiust = this.getView().getModel("autorizzazioneGiustificativaModel").getProperty("/FINCODE")
                    // let oSeqAuth = this.getView().getModel("autorizzazioneGiustificativaModel").getProperty("/SEQ_AUT")
                modelHome.setProperty("/tableSStrBusy", true)
                modelHome.setProperty("/sottostrumenti", [])

                if (this.getView().getModel("sottostrumentiModel") !== undefined) {
                    this.getView().getModel("sottostrumentiModel").setProperty("/", [])
                }

                //let annoSStr = new Date(new Date().setFullYear(new Date().getFullYear() + 1)) 

                var aFiltersCompose = [new Filter("AnnoSstr", FilterOperator.EQ, modelHome.getProperty("/formSottostrumento/esercizio")),
                    new Filter("Fase", FilterOperator.EQ, "NV"),
                    new Filter("Fikrs", FilterOperator.EQ, "S001"),
                    new Filter("FaseAttiva", FilterOperator.EQ, "X")
                ];

                //Stato Sottostrumento
                if (modelHome.getProperty("/formSottostrumento/stato") !== "") {
                    aFiltersCompose.push(new Filter("StatoSstr", FilterOperator.EQ, modelHome.getProperty("/formSottostrumento/stato")))
                }
                //Autorizzazione Giustificativa
                // if(oAuthGiust && oSeqAuth && oAuthGiust.FINCODE && oSeqAuth.SEQ_AUT){
                //     aFiltersCompose.push(new Filter({
                //         path: "SeqAut",
                //         operator: FilterOperator.EQ,
                //         value1: oSeqAuth.SEQ_AUT
                //     }))
                //     aFiltersCompose.push(new Filter({
                //         path: "Fincode",
                //         operator: FilterOperator.EQ,
                //         value1: oAuthGiust.FINCODE
                //     }))
                // }
                //Esposizione Contabile
                if (modelHome.getProperty("/formSottostrumento/esposizione_contabile") && modelHome.getProperty(
                        "/formSottostrumento/esposizione_contabile").length > 1) {
                    aFiltersCompose.push(new Filter({
                        path: "TipoEsposizione",
                        operator: FilterOperator.EQ,
                        value1: modelHome.getProperty("/formSottostrumento/esposizione_contabile").split("-")[0]
                    }))
                } else {
                    let aFilterEspContCompose = []
                    modelHome.getProperty("/formSottostrumento/esposizione_contabileSet").map((espCont) => {
                        if (espCont.Esposizione) {
                            aFilterEspContCompose.push(new Filter({
                                path: "TipoEsposizione",
                                operator: FilterOperator.EQ,
                                value1: espCont.Esposizione.split("-")[0]
                            }))
                        }
                    })
                    let afiltersEspCont =
                        new Filter({
                            filters: aFilterEspContCompose,
                            and: false,
                            or: true
                        })

                    aFiltersCompose.push(afiltersEspCont)
                }
                //Numero Sottostrumento
                if (modelHome.getProperty("/formSottostrumento/codice_sstr")) {
                    aFiltersCompose.push(new Filter({
                        path: "NumeroSstr",
                        operator: FilterOperator.EQ,
                        value1: modelHome.getProperty("/formSottostrumento/codice_sstr")
                    }), )
                }
                //Descrizione Sottostrumento
                if (modelHome.getProperty("/formSottostrumento/descrizione_sstr")) {
                    aFiltersCompose.push(new Filter({
                        path: "DescEstesa",
                        operator: FilterOperator.Contains,
                        value1: modelHome.getProperty("/formSottostrumento/descrizione_sstr").toUpperCase()
                    }), )
                }
                //Tipologia Sottostrumento
                if (modelHome.getProperty("/formSottostrumento/tipologia")) {
                    aFiltersCompose.push(new Filter({
                        path: "TipoSstr",
                        operator: FilterOperator.EQ,
                        value1: modelHome.getProperty("/formSottostrumento/tipologia")
                    }), )
                } else {
                    let aFilterTipologiaCompose = []
                    modelHome.getProperty("/formSottostrumento/tipologieSet").map((tipologie) => {
                        if (tipologie.Tipologia) {
                            aFilterTipologiaCompose.push(new Filter({
                                path: "TipoSstr",
                                operator: FilterOperator.EQ,
                                value1: "54"
                            }))
                        }
                    })
                    let afiltersTipologia =
                        new Filter({
                            filters: aFilterTipologiaCompose,
                            and: false,
                            or: true
                        })

                    aFiltersCompose.push(afiltersTipologia)
                }

                //Visibilità
                if (modelHome.getProperty("/formSottostrumento/visibilita")) {
                    aFiltersCompose.push(new Filter({
                        path: "Reale",
                        operator: FilterOperator.EQ,
                        value1: modelHome.getProperty("/formSottostrumento/visibilita")
                    }), )
                } else {
                    let aFilterVisibilitaCompose = []
                    modelHome.getProperty("/formSottostrumento/visibilitaSet").map((vis) => {
                        if (vis.Reale) {
                            aFilterVisibilitaCompose.push(new Filter({
                                path: "Reale",
                                operator: FilterOperator.EQ,
                                value1: vis.Reale
                            }))
                        }
                    })
                    let afiltersVisibilita =
                        new Filter({
                            filters: aFilterVisibilitaCompose,
                            and: false,
                            or: true
                        })
                    aFiltersCompose.push(afiltersVisibilita)
                }
                if (modelHome.getData().NStrumento) {
                    aFiltersCompose.push(new Filter({
                        path: "CodiceStrumento",
                        operator: FilterOperator.EQ,
                        value1: modelHome.getData().NStrumentoCompleto
                    }), )
                }

                var _filters = [
                    new Filter({
                        filters: _filters,
                        and: true
                    })
                ]
                if (modelHome.getProperty("/formSottostrumento/esposizione_contabileSet").filter(esp => esp.Esposizione !== null).length > 0 &&
                    modelHome.getProperty("/formSottostrumento/tipologieSet").filter(tip => tip.Fase !== null).length > 0) {
                    oModel.read("/SottostrumentoSet", {
                        urlParameters: {
                            $expand: "DomInterno,DomAmministrazione,DomMissione,DomTitolo"
                        },
                        filters: aFiltersCompose,
                        sorters: [new sap.ui.model.Sorter("TipoSstr", false),
                            new sap.ui.model.Sorter("NumeroSstr", false)
                        ], //new sap.ui.model.Sorter("NumeroSottostrumento", false),
                        success: (oData, response) => {
                            //Filtro per Dominio Sottostrumento
                            oData.results = oData.results.filter(sstr => sstr.TipoSstr !== "81")
                            oData.results = oData.results.filter(sstr => sstr.NumeroSstr !== "000300")
                            oData.results = oData.results.filter(sstr => sstr.NumeroSstr !== "000700")
                            oData.results = oData.results.filter(sstr => sstr.NumeroSstr !== "000701")
                            //! lt effettuo il check sul sottostrumento senza flag
                            oData.results = oData.results.filter(sstr => !sstr.Flag_Pref) 
                            let arrDataResults = []
                                //codice da buttare lt
                                /* var sottostrumentiConDominio = []
                                oData.results.forEach(obj => {

                                        //CodiceSottostrumento
                                        if(obj.DomInterno.results > 0)sottostrumentiConDominio.push(obj)
                                        
                                }); */

                            var esclusi = [];

                            for (let i = 0; i < oData.results.length; i++) {
                                if (oData.results[i].DomTitolo.results.length === 0 && oData.results[i].DomMissione.results.length === 0 &&
                                    oData.results[i].DomAmministrazione.results.length === 0 && oData.results[i].DomInterno.results.length === 0) {
                                    arrDataResults.push(oData.results[i])
                                } else {
                                    let oResults = this.__checkDominioSStr(oData.results[i])
                                    if (oResults !== null) {
                                        arrDataResults.push(oData.results[i])
                                    } else {
                                        esclusi.push(oData.results[i])
                                    }
                                }
                            }
                            console.log(esclusi)
                                /* if((modelHome.getProperty("/formSottostrumento/var_struttura") === true || modelHome.getProperty("/formSottostrumento/var_contabili") === true ||
                                modelHome.getProperty("/formSottostrumento/FB") === true || modelHome.getProperty("/formSottostrumento/FL") === true 
                                || modelHome.getProperty("/formSottostrumento/OI") === true) ) {
                                        arrDataResults = arrDataResults.filter(item => item.DomAmministrazione.results.length !== 0 &&
                                                item.DomMissione.results.length !== 0 && item.DomInterno.results.length !== 0 && item.DomTitolo.results.length !== 0)     
                                        } */
                            modelHome.setProperty("/sottostrumenti", arrDataResults)
                            modelHome.setProperty("/tableSStrBusy", false)
                        },
                        error: (e) => {
                            modelHome.setProperty("/tableSStrBusy", false)
                        }
                    });
                } else {
                    modelHome.setProperty("/tableSStrBusy", false)
                    modelHome.setProperty("/sottostrumenti", [])
                }

                if (!this._oDialog) {
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
            onPressConfermaSottostrumento: function (oEvent) {
                let modelHome = this.getView().getModel("modelHome")
                /* let selectedPath = sap.ui.getCore().byId("idTableSottostrumento2").getSelectedContextPaths()[0]
                let selectedItem = modelHome.getProperty(selectedPath) */
                let selectedItem = this.returnObjBinded("modelHome" , oEvent)
                
                modelHome.setProperty("/Sottostrumento", `${selectedItem.DescTipoSstr} - ${selectedItem.NumeroSstr}`)
                modelHome.setProperty("/infoSottoStrumento", selectedItem)
                modelHome.setProperty("/esercizio", selectedItem.AnnoSottostrumento)
    
                this.oDialogHVSottoStrumento.close();
                this._oDialog.close()
                this.oDialogHVSottoStrumento.destroy();
                this._oDialog.destroy()
                this.oDialogHVSottoStrumento = null
                this._oDialog = null
                //!LT richiesta di navigazione diretta
                this.onNavigate()

            },
            onNavigate: function () {
                let modelHome = this.getView().getModel("modelHome")
                let oSottostrumento = modelHome.getProperty("/infoSottoStrumento")
                var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                if(!oSottostrumento){
                    MessageBox.warning("Per poter continuare selezionare lo strumento e il sottostrumento")
                    return
                }

                if(oSottostrumento.StatoSstr === '1') {
                    if(oSottostrumento.TipoEsposizione === "0" || oSottostrumento.TipoEsposizione === "2") {
                        oRouter.navTo("HomePosFin",{
                            Fikrs: oSottostrumento.Fikrs,
                            CodiceStrumento: oSottostrumento.CodiceStrumento,
                            CodiceStrumentoOri: oSottostrumento.CodiceStrumentoOri,
                            CodiceSottostrumento: oSottostrumento.CodiceSottostrumento,
                            Datbis: oSottostrumento.Datbis.toISOString()
                        });
                    } else if(oSottostrumento.TipoEsposizione === "1"){
                        oRouter.navTo("RimodulazioneVerticale",{
                            Fikrs: oSottostrumento.Fikrs,
                            CodiceStrumento: oSottostrumento.CodiceStrumento,
                            CodiceStrumentoOri: oSottostrumento.CodiceStrumentoOri,
                            CodiceSottostrumento: oSottostrumento.CodiceSottostrumento,
                            Datbis: oSottostrumento.Datbis.toISOString()
                        });
                    } else if (["5","6","7","9"].includes(oSottostrumento.TipoEsposizione)) {
                        oRouter.navTo("Finanziamento",{
                            Fikrs: oSottostrumento.Fikrs,
                            CodiceStrumento: oSottostrumento.CodiceStrumento,
                            CodiceStrumentoOri: oSottostrumento.CodiceStrumentoOri,
                            CodiceSottostrumento: oSottostrumento.CodiceSottostrumento,
                            Datbis: oSottostrumento.Datbis.toISOString()
                        });
                    }
                    //prima di navigare resetto il modello
                    this.onResetSStr();
                    this.onResetVHSstr();
                    } else {
                        MessageBox.warning("Non puoi operare con Sottostrumento chiuso")
                    }
            },
            onFormatTipoEsposizione:function (sTipoEsposizione) {
                   const modelHome = this.getView().getModel("modelHome")
                   const aTipologie = modelHome.getProperty("/formSottostrumento/esposizione_contabileSet")
                   return aTipologie.find(es => es.TipoEsposizione === sTipoEsposizione).TipoEsposizioneDescr
               },
            onResetVHSstr: function (oEvent) {
                    this.__resetFiltri()
            },
            onChangeSelect: function (oEvent) {
                //debugger
                let oModel = this.getOwnerComponent().getModel("sapHanaS2");
                let modelHome = this.getView().getModel("modelHome")
                const sIdChange = oEvent.getParameter("id")
                let sExpand = ""
                let aFilter = [new Filter("Anno", FilterOperator.EQ,  modelHome.getProperty("/formSottostrumento/esercizio")),
                               new Filter("Fase", FilterOperator.EQ, "NV"),
                                new Filter("Fikrs", FilterOperator.EQ, "S001"),
                                new Filter({
                                    filters:[ new Filter("Tipologia", FilterOperator.NE, "83"),
                                              new Filter("Tipologia", FilterOperator.NE, "53"),
                                              new Filter("Tipologia", FilterOperator.NE, "51"),
                                              new Filter("Esposizione", FilterOperator.NE, "E")
                                            ],
                                    and: true
                                })
                            ]
                switch (sIdChange) {
                    case 'idformStTipologia':
                        if(modelHome.getProperty("/formSottostrumento/tipologia")){
                            aFilter.push(new Filter("Tipologia", FilterOperator.EQ, modelHome.getProperty("/formSottostrumento/tipologia")))
                            //sExpand = sExpand + "ToSHEsposizione,ToSHVisibilita"
                            if(modelHome.getProperty("/formSottostrumento/tipologia") === "53"){
                                modelHome.setProperty("/formSottostrumento/var_contabili", true)
                            } else {
                                modelHome.setProperty("/formSottostrumento/var_contabili", false)
                            }
                        }
                        break;
                    case 'idformStEspCont':
                        if(modelHome.getProperty("/formSottostrumento/esposizione_contabile").length > 1){
                            let arrKeyTipoEsp = modelHome.getProperty("/formSottostrumento/esposizione_contabile").split("-")
                            aFilter.push(new Filter("Esposizione", FilterOperator.EQ, arrKeyTipoEsp[0]))
                            // aFilter.push(new Filter("Progr", FilterOperator.EQ, arrKeyTipoEsp[1]))
                            // sExpand = sExpand + "ToSHTipologia,ToSHVisibilita"
                            if(modelHome.getProperty("/formSottostrumento/esposizione_contabile") !== '0' && modelHome.getProperty("/formSottostrumento/solo_struttura") === true){
                                modelHome.setProperty("/formSottostrumento/solo_struttura", false)
                                modelHome.setProperty("/formSottostrumento/nessuna_restrizione", true)
                            }
                        }
                        break
                    case 'idFormStVisibilita':
                        if(modelHome.getProperty("/formSottostrumento/visibilita")){
                            aFilter.push(new Filter("Reale", FilterOperator.EQ, modelHome.getProperty("/formSottostrumento/visibilita")))
                            // sExpand = sExpand + "ToSHTipologia,ToSHEsposizione"
                        }
                        break
                    default:
                        break;
                }
                oModel.read("/TipologiaEsposizioneVisibilitaSet", { 
                    filters: aFilter,
                    success:  (oData) => {
                        //debugger
                         //Lista Tipologie
                         if(sIdChange !== "idformStTipologia") {
                            let aTipologia = this.__removeDuplicate(oData.results, "tipologia")
                            aTipologia.unshift({Esposizione: null, DescrEsposizione: "", Fase: null, Anno: null})
                            modelHome.setProperty("/formSottostrumento/tipologieSet", aTipologia)
                         }

                         //lista esposizione contabile
                         if(sIdChange !== "idformStEspCont") {
                            let aEsposizioneContabile = this.__removeDuplicate(oData.results, "esposizione")
                            aEsposizioneContabile = aEsposizioneContabile.filter(ec => ec.DescrEsposizione !== "")
                            aEsposizioneContabile.unshift({Esposizione: null, DescrEsposizione: "", Fase: null, Anno: null})
                            modelHome.setProperty("/formSottostrumento/esposizione_contabileSet", aEsposizioneContabile)
                         }
 
                         //Lista Visibilità
                         if(sIdChange !== "idFormStVisibilita") {
                            let aVisibilita = this.__removeDuplicate(oData.results, "visibilita")
                            aVisibilita.unshift({Reale: null, DescrReale: "", Fase: null, Anno: null})
                            modelHome.setProperty("/formSottostrumento/visibilitaSet", aVisibilita)
                         }
                    },
                    error: function (res) {
                        //debugger
                    }
                })
            },
            onResetSStr: function () {
                let modelHome = this.getView().getModel("modelHome")
                modelHome.setProperty("/Sottostrumento", null)
                modelHome.setProperty("/infoSottoStrumento", null)
				modelHome.setProperty("/NStrumento", null)
				modelHome.setProperty("/CodSTR", null)
				modelHome.setProperty("/DescrSiglaTipoStr", null)
				this.getView().byId("idSstr").setEnabled(false);
				// modelHome.setProperty("/infoStrumento", null)
				modelHome.setProperty("/NStrumentoCompleto", null)
            },
            initDataDomSStr: function () {
                 let modelHome = this.getView().getModel("modelHome")
                 let modelHana = this.getOwnerComponent().getModel("sapHanaS2")

                 modelHana.read("/TipTitoloSet", { 
                    filters: [new Filter("Fase", FilterOperator.EQ, "NV"),
                              new Filter("Anno", FilterOperator.EQ, modelHome.getProperty("/formSottostrumento/esercizio")),
                            new Filter({
                                filters: [
                                            new Filter("Reale", FilterOperator.EQ, "R"),
                                            new Filter("Reale", FilterOperator.EQ, "S")
                                        ],
                                and: false,
                            })
                        ],
                    success: (oData, res) => {
                        //debugger
                        this.__setPropertyFiltriTitoloDomSStr(oData)
                    },
                    error: (err) => {
                        //debugger
                    }
                 })
                 modelHana.read("/TipMissioneSet", { 
                    filters: [new Filter("Fase", FilterOperator.EQ, "NV"),
                              new Filter("Anno", FilterOperator.EQ, modelHome.getProperty("/formSottostrumento/esercizio"))],
                    success: (oData, res) => {
                        //debugger
                        this.__setPropertyFiltriMissioneDomSStr(oData)
                    },
                    error: (err) => {
                        //debugger
                    }
                 })
               
            },
            onHRDomSStr: function (oEvent) {
                let {key, value} = oEvent.getSource().getCustomData()[0].mProperties
                this.__getDataHV(value)
                Fragment.load({
                    name:"zsap.com.r3.cobi.s4.gestposfinnv.view.fragment." + value,
                    controller: this
                }).then(oDialog => {
                    this[value] = oDialog
                    this.getView().addDependent(oDialog);
                    this[value].open()
                })
            },
            __getDataHV: function (popup) {
                let modelHome = this.getView().getModel("modelHome")
                const modelHana = this.getOwnerComponent().getModel("sapHanaS2");
                let aFilters = [
                    new Filter("Fase", FilterOperator.EQ, "NV"),
                    new Filter("Fikrs", FilterOperator.EQ, "S001"),
                    new Filter("Anno", FilterOperator.EQ, modelHome.getProperty("/formSottostrumento/esercizio"))
                ]
                let aMissioniScelte = []
                let aProgrammiScelti = []
                let aTitoliSingle = []
                let aTitoliScelti = []
                let aCategorieScelte = []
                let aCE2Scelte = []
                let filterTitoliSingle = []
                let aCallDb = []
                switch (popup) {
                    case "HelpValueProgramma":
                        aMissioniScelte = modelHome.getProperty("/formSottostrumento/missioni/")
                        if(aMissioniScelte.length > 0){
                            aFilters.push(this.__setMultiFiltersMissione(aMissioniScelte, ["Missione"]))
                            modelHana.read("/TipMissioneSet", {
                                filters: aFilters,
                                success: (oData) => {
                                    //debugger
                                    let aProgrammi = this.__removeDuplicate(oData.results, "programma")
                                    modelHome.setProperty("/formSottostrumento/programma_set", aProgrammi)
                                }
                            })
                        }
                        break;
                        case "HelpValueAzione":
                            aProgrammiScelti =  modelHome.getProperty("/formSottostrumento/programmi/")
                            let filterMissioniSingle = [... aFilters]
                            if(aProgrammiScelti.length > 0){
                                aFilters.push(this.__setMultiFiltersMissione(aProgrammiScelti, ["Missione", "Programma"]))
                                aCallDb.push(this.__getDataPromise("/TipMissioneSet", aFilters, modelHana))
                            }
                            aMissioniScelte = modelHome.getProperty("/formSottostrumento/missioni/")  
                            let aMissioniSingle = []//missioni non scelte da programma
                            for(let i = 0; i < aMissioniScelte.length; i++) {
                                if(! aProgrammiScelti.find(pr => pr.Missione === aMissioniScelte[i].Missione)) {
                                    aMissioniSingle.push(aMissioniScelte[i])
                                }
                            }
                            if(aMissioniSingle.length > 0) {
                                filterMissioniSingle.push(this.__getFiltersOR(aMissioniSingle, "Missione"))
                                aCallDb.push(this.__getDataPromise("/TipMissioneSet", filterMissioniSingle, modelHana))
                            }
                            if(aCallDb.length > 0) {
                                Promise.all(aCallDb).then((res) => {
                                    //debugger
                                    let aAzioniResults = []
                                    for(let i = 0; i < res[0].length ; i++){
                                        aAzioniResults.push(res[0][i])
                                    }
                                    if(res.length > 1) {
                                        for(let i = 0; i < res[1].length ; i++){
                                            aAzioniResults.push(res[1][i])
                                        }
                                    }
                                    modelHome.setProperty("/formSottostrumento/azione_set", aAzioniResults)
                                }).catch((err) => {
                                    //debugger
                                })
                            }
                            break;
                        case "HelpValueCategoria":
                            aTitoliScelti = modelHome.getProperty("/formSottostrumento/titoli/")
                            if(aTitoliScelti.length > 0){
                                aFilters.push(this.__setMultiFiltersMissione(aTitoliScelti, ["Titolo"]))
                                modelHana.read("/TipTitoloSet", {
                                    filters: aFilters,
                                    success: (oData) => {
                                        //debugger
                                        let aCategoria = this.__removeDuplicate(oData.results, "categoria")
                                        modelHome.setProperty("/formSottostrumento/categoria_set", aCategoria)
                                    }
                                })
                            }
                            break;
                        case "HelpValueEconomica2":
                            aCategorieScelte = modelHome.getProperty("/formSottostrumento/categoria/")
                            // let filterCategorieSingle = [... aFilters]
                            filterTitoliSingle = [... aFilters]
                            if(aCategorieScelte.length > 0){
                                aFilters.push(this.__setMultiFiltersMissione(aCategorieScelte, ["Titolo", "Categoria"]))
                                aCallDb.push(this.__getDataPromise("/TipTitoloSet", aFilters, modelHana))
                            }
                            aTitoliScelti = modelHome.getProperty("/formSottostrumento/titoli/")
                            aTitoliSingle = []
                            for(let i = 0; i < aTitoliScelti.length; i++) {
                                if(! aCategorieScelte.find(pr => pr.Titolo === aTitoliScelti[i].Titolo)) {
                                    aTitoliSingle.push(aTitoliScelti[i])
                                }
                            }
                            if(aTitoliSingle.length > 0) {
                                filterTitoliSingle.push(this.__getFiltersOR(aTitoliSingle, "Titolo"))
                                aCallDb.push(this.__getDataPromise("/TipTitoloSet", filterTitoliSingle, modelHana))
                            }
                            if(aCallDb.length > 0) {
                                Promise.all(aCallDb).then((res) => {
                                    //debugger
                                    let aCE2Results = []
                                    for(let i = 0; i < res[0].length ; i++){
                                        aCE2Results.push(res[0][i])
                                    }
                                    if(res.length > 1) {
                                        for(let i = 0; i < res[1].length ; i++){
                                            aCE2Results.push(res[1][i])
                                        }
                                    }
                                    modelHome.setProperty("/formSottostrumento/economica2_set", this.__removeDuplicate(aCE2Results, "ce2"))
                                }).catch((err) => {
                                    //debugger
                                })
                            }
                            break;
                        case "HelpValueEconomica3":
                            aCE2Scelte = modelHome.getProperty("/formSottostrumento/economica2/")
                            filterTitoliSingle = [... aFilters]
                            let filterCategorieSingle = [... aFilters]
                            //filtri su CE2 selezionate
                            if(aCE2Scelte.length > 0){
                                aFilters.push(this.__setMultiFiltersMissione(aCE2Scelte, ["Titolo", "Categoria", "Ce2"]))
                                aCallDb.push(this.__getDataPromise("/TipTitoloSet", aFilters, modelHana))
                            }
                            //Filtri su Categorie disaccoppiate da CE2
                            aCategorieScelte = modelHome.getProperty("/formSottostrumento/categoria/")
                            let aCategorieSingle = []
                            for(let i = 0; i < aCategorieScelte.length; i++) {
                                if(! aCE2Scelte.find(pr => (pr.Titolo === aCategorieScelte[i].Titolo && pr.Categoria === aCategorieScelte[i].Categoria))) {
                                    aCategorieSingle.push(aCategorieScelte[i])
                                }
                            }
                            if(aCategorieSingle.length > 0) {
                                filterCategorieSingle.push(this.__getFiltersOR(aCategorieSingle, "Categoria"))
                                aCallDb.push(this.__getDataPromise("/TipTitoloSet", filterCategorieSingle, modelHana))
                            }
                            //Filtri su Titoli disaccoppitati da scelta di uno dei figli
                            aTitoliScelti = modelHome.getProperty("/formSottostrumento/titoli/")
                            aTitoliSingle = []
                            for(let i = 0; i < aTitoliScelti.length; i++) {
                                if(! aCategorieScelte.find(pr => pr.Titolo === aTitoliScelti[i].Titolo)) {
                                    aTitoliSingle.push(aTitoliScelti[i])
                                }
                            }
                            if(aTitoliSingle.length > 0) {
                                filterTitoliSingle.push(this.__getFiltersOR(aTitoliSingle, "Titolo"))
                                aCallDb.push(this.__getDataPromise("/TipTitoloSet", filterTitoliSingle, modelHana))
                            }
                            //chiamate a DB
                            if(aCallDb.length > 0) {
                                Promise.all(aCallDb).then((res) => {
                                    //debugger
                                    let aCE3Results = []
                                    for(let i = 0; i < res[0].length ; i++){
                                        aCE3Results.push(res[0][i])
                                    }
                                    if(res.length > 1) {
                                        for(let i = 0; i < res[1].length ; i++){
                                            aCE3Results.push(res[1][i])
                                        }
                                    }
                                    if(res.length > 2) {
                                        for(let i = 0; i < res[1].length ; i++){
                                            aCE3Results.push(res[2][i])
                                        }
                                    }
                                    modelHome.setProperty("/formSottostrumento/economica3_set", aCE3Results)
                                }).catch((err) => {
                                    //debugger
                                })
                            }
                            break;
                    default:
                        break;
                }
            },
            onConfirmSelectionDomSStr: function (oEvent) {
                let oTable = oEvent.getSource().getParent().getContent()[0]
                let sPathToUpdate  = oTable.getCustomData().find(cd => cd.getKey() === "selezioni").getValue()
                let modelHome = this.getView().getModel("modelHome")
                let aSelectedPaths = oTable.getSelectedContextPaths()
                let selectedItems = []
                for(let i = 0; i < aSelectedPaths.length; i++){
                    let currentItem = modelHome.getProperty(aSelectedPaths[i])
                    selectedItems.push(currentItem)
                }
                modelHome.setProperty("/formSottostrumento/" + sPathToUpdate, selectedItems)
                //modelHome.updateBindings(true)
                oEvent.getSource().getParent().close()
                this.__refreshItemsFilterDomSStr(sPathToUpdate) //aggiorna le altre liste/Tabelle in seguito a una selezione
            },
            onSearchHVAzioni: function (oEvent) {
                oEvent.getSource().getParent().getParent().getBinding("items").filter([new Filter("DESC_BREVE", FilterOperator.Contains, oEvent.getParameter("query"))])
            },
            setSelectedAzioni: function (azione, amm, missione, programma) {
                let modelHome = this.getView().getModel("modelHome")
                let aAzioni = modelHome.getProperty("/formSottostrumento/azioni")
                return  aAzioni.filter(item => (item.Prctr === amm && item.Azione === azione && 
                    item.Programma === programma && item.Missione === missione)).length > 0
                
            },
            onUpdateStartedHVDomSStr: function (oEvent) {
                oEvent.getSource().setBusy(true)
            },
            onUpdateFinishedHVDomSStr: function (oEvent) {
                oEvent.getSource().setBusy(false)
            },
            onCloseHVDomSStr: function (oEvent) {
                oEvent.getSource().getParent().close() 
            },
            onDeleteTokenDomSStr: function (oEvent) {
                let modelHome = this.getView().getModel("modelHome")
                let aSplitPathDeleted = []
                let sPathToUpdate = ""

                if(oEvent.getId() === 'tokenUpdate') {
                    sPathToUpdate = oEvent.getSource().getCustomData().find(cd => cd.getKey() === "deleteToken").getValue()
                    aSplitPathDeleted = oEvent.getParameter("removedTokens")[0].getBindingContext("modelHome").getPath().split("/")
                }
                else {
                    sPathToUpdate = oEvent.getSource().getParent().getParent().getCustomData().find(cd => cd.getKey() === "deleteToken").getValue()
                    aSplitPathDeleted = oEvent.getParameter("token").getBindingContext("modelHome").getPath().split("/")
                }

                let sIndexDeleted = aSplitPathDeleted[aSplitPathDeleted.length - 1]
                let aSelectedItems = modelHome.getProperty("/formSottostrumento/" + sPathToUpdate)
                //prima della rimozione del token, elimino i figli
                this.__deleteTokenChildrenDomSStr(aSplitPathDeleted)
                aSelectedItems.splice(Number(sIndexDeleted), 1)
                modelHome.updateBindings(true)
            },
            __deleteTokenChildrenDomSStr: function (aSplitPathDeleted) {
                let modelHome = this.getView().getModel("modelHome")
                const modelHana = this.getOwnerComponent().getModel("sapHanaS2");
                //determino i figli da eliminare
                let aEconomica3New = []
                let aEconomica3 = []
                let aEconomica2New = []
                let aEconomica2 = []
                let aCategoriaNew = []
                let aCategoria = []
                let aProgramma = []
                let aProgrammaNew = []
                let aAzioniNew = []
                let aAzioni = []
                let oFatherDeleted = {}
                let aFilters = []
                switch (aSplitPathDeleted[2]) {
                    case "economica2": //economica 2 ha figlio economica3
                        //estrazione padre in eliminazione
                         oFatherDeleted = modelHome.getProperty(`/formSottostrumento/${aSplitPathDeleted[2]}/${aSplitPathDeleted[3]}`)
                         aEconomica3 = modelHome.getProperty("/formSottostrumento/economica3")
                       if(oFatherDeleted !== undefined){
                            for(let i = 0; i < aEconomica3.length; i++){
                                if(!(aEconomica3[i].Ce2 === oFatherDeleted.Ce2 && aEconomica3[i].Categoria === oFatherDeleted.Categoria &&
                                    aEconomica3[i].Titolo === oFatherDeleted.Titolo) )
                                    aEconomica3New.push(aEconomica3[i])
                            }
                            modelHome.setProperty("/formSottostrumento/economica3", aEconomica3New)

                            let aEconomica2 =  modelHome.getProperty("/formSottostrumento/economica2")
                            aEconomica2.map(ce2 => {
                                aFilters.push(new Filter("Categoria", FilterOperator.EQ, ce2.Categoria))
                                aFilters.push(new Filter("Titolo", FilterOperator.EQ, ce2.Titolo))
                                aFilters.push(new Filter("Ce2", FilterOperator.EQ, ce2.Ce2))
                            })
                        }
                        break;
                    case "categoria": //categoria  figlio economica2 e economica3
                        //estrazione padre in eliminazione 
                         oFatherDeleted = modelHome.getProperty(`/formSottostrumento/${aSplitPathDeleted[2]}/${aSplitPathDeleted[3]}`)
                         aEconomica3 = modelHome.getProperty("/formSottostrumento/economica3")
                         aEconomica2 = modelHome.getProperty("/formSottostrumento/economica2")
                       if(oFatherDeleted !== undefined){
                            for(let i = 0; i < aEconomica3.length; i++){
                                if(!(aEconomica3[i].Categoria === oFatherDeleted.Categoria && aEconomica3[i].Ce2 === oFatherDeleted.Ce2))
                                    aEconomica3New.push(aEconomica3[i])
                            }
                            modelHome.setProperty("/formSottostrumento/economica3", aEconomica3New)

                            for(let i = 0; i < aEconomica2.length; i++){
                                if(!(aEconomica2[i].Titolo === oFatherDeleted.Titolo && aEconomica2[i].Categoria === oFatherDeleted.Categoria))
                                    aEconomica2New.push(aEconomica2[i])
                            }
                            modelHome.setProperty("/formSottostrumento/economica2", aEconomica2New)

                            let aCategoria=  modelHome.getProperty("/formSottostrumento/categoria")
                            aCategoria.map(cat => {
                                aFilters.push(new Filter("Titolo", FilterOperator.EQ, cat.Titolo))
                                aFilters.push(new Filter("Categoria", FilterOperator.EQ, cat.Categoria))
                            })
                        }
                        break;
                    case "titoli": //categoria  figlio economica2 e economica3
                        //estrazione padre in eliminazione 
                         oFatherDeleted = modelHome.getProperty(`/formSottostrumento/${aSplitPathDeleted[2]}/${aSplitPathDeleted[3]}`)
                         aEconomica3 = modelHome.getProperty("/formSottostrumento/economica3")
                         aEconomica2 = modelHome.getProperty("/formSottostrumento/economica2")
                         aCategoria = modelHome.getProperty("/formSottostrumento/categoria")
                       if(oFatherDeleted !== undefined){
                            for(let i = 0; i < aEconomica3.length; i++){
                                if(!(aEconomica3[i].Categoria === oFatherDeleted.Categoria && aEconomica3[i].Ce2 === oFatherDeleted.Ce2 &&
                                    aEconomica3[i].Titolo === oFatherDeleted.Titolo))
                                    aEconomica3New.push(aEconomica3[i])
                            }
                            modelHome.setProperty("/formSottostrumento/economica3", aEconomica3New)

                            for(let i = 0; i < aEconomica2.length; i++){
                                if(!(aEconomica2[i].Titolo === oFatherDeleted.Titolo && aEconomica2[i].Categoria === oFatherDeleted.Categoria))
                                    aEconomica2New.push(aEconomica2[i])
                            }
                            modelHome.setProperty("/formSottostrumento/economica2", aEconomica2New)

                            for(let i = 0; i < aCategoria.length; i++){
                                if(aCategoria[i].Titolo !== oFatherDeleted.Titolo)
                                    aCategoriaNew.push(aCategoria[i])
                            }
                            modelHome.setProperty("/formSottostrumento/categoria", aCategoriaNew)

                            let aTitoli=  modelHome.getProperty("/formSottostrumento/titoli")
                            aTitoli.map(tit => {
                                aFilters.push(new Filter("Titolo", FilterOperator.EQ, tit.Titolo))
                            })
                        }
                        break;
                    case "missioni":
                        oFatherDeleted = modelHome.getProperty(`/formSottostrumento/${aSplitPathDeleted[2]}/${aSplitPathDeleted[3]}`)
                        aProgramma = modelHome.getProperty("/formSottostrumento/programmi")
                        aAzioni = modelHome.getProperty("/formSottostrumento/azioni")

                        for(let i = 0; i < aProgramma.length; i++){
                            if(!(aProgramma[i].Missione === oFatherDeleted.Missione && aProgramma[i].Programma === oFatherDeleted.Programma ))
                                aProgrammaNew.push(aProgramma[i])
                        }
                        modelHome.setProperty("/formSottostrumento/programmi", aProgrammaNew)

                        for(let i = 0; i < aAzioni.length; i++){
                            if(!(aAzioni[i].Missione === oFatherDeleted.Missione && aAzioni[i].Programma === oFatherDeleted.Programma 
                                && aAzioni[i].Azione === oFatherDeleted.Azione))
                                aAzioniNew.push(aAzioni[i])
                        }
                        modelHome.setProperty("/formSottostrumento/azioni", aAzioniNew)

                        let aMissioni = modelHome.getProperty("/formSottostrumento/missioni").filter(mis => mis.Missione !== oFatherDeleted.Missione)
                        aMissioni.map(ms => {
                            aFilters.push(new Filter("Missione", FilterOperator.EQ, ms.Missione))
                        })
                        break;
                    case "programmi":
                        oFatherDeleted = modelHome.getProperty(`/formSottostrumento/${aSplitPathDeleted[2]}/${aSplitPathDeleted[3]}`)
                        aAzioni = modelHome.getProperty("/formSottostrumento/azioni")
                        for(let i = 0; i < aAzioni.length; i++){
                            if(!(aAzioni[i].Missione === oFatherDeleted.Missione && aAzioni[i].Programma === oFatherDeleted.Programma 
                                && aAzioni[i].Azione === oFatherDeleted.Azione))
                                aAzioniNew.push(aAzioni[i])
                        }
                        modelHome.setProperty("/formSottostrumento/azioni", aAzioniNew)

                        aProgramma= modelHome.getProperty("/formSottostrumento/programmi").filter(pr => pr.Programma !== oFatherDeleted.Programma)
                        aProgramma.map(pr => {
                            aFilters.push(new Filter("Programma", FilterOperator.EQ, pr.Programma))
                        })
                        break;
                    default:
                        break;
                }
                //refres dati lista valori dei value Help
                // if(aSplitPathDeleted[2] === "titoli" || aSplitPathDeleted[2] ==="categoria" || aSplitPathDeleted[2] ==="economica2")
                //     modelHana.read("/Gest_SH1_TitoloSet", {
                //         filters: aFilters,
                //         success: (oData, res) => {
                //             //debugger
                //             //this.__setPropertyFiltriTitoloDomSStr(oData)
                //             this.__setPropertyHVChildren(aSplitPathDeleted[2], oData)
                //         },
                //         error: (err) => {
                //             //debugger
                //         }
                //     })
                // if(aSplitPathDeleted[2] === "missioni" || aSplitPathDeleted[2] === "programmi" || aSplitPathDeleted[2] === "azioni")
                //     modelHana.read("/Gest_SH1_MissioneSet", {
                //         filters: aFilters,
                //         success: (oData, res) => {
                //             //debugger
                //             //this.__setPropertyFiltriTitoloDomSStr(oData)
                //             this.__setPropertyHVChildren(aSplitPathDeleted[2], oData)
                //         },
                //         error: (err) => {
                //             //debugger
                //         }
                //     })

            },
            __getAllIndexes(arr, val, property) {
                var indexes = [], i;
                for(i = 0; i < arr.length; i++)
                    if (arr[i][property] === val)
                        indexes.push(i);
                return indexes;
            },
            setSelectedProgrammi: function (missione, amm, programma) {
                let modelHome = this.getView().getModel("modelHome")
                let aProgrammi = modelHome.getProperty("/formSottostrumento/programmi")
                return  aProgrammi.filter(item => ( item.Programma === programma && item.Missione === missione)).length > 0
            },
            setSelectedCE3: function (titolo, categoria, ce2, ce3) {
                let modelHome = this.getView().getModel("modelHome")
                let aProgrammi = modelHome.getProperty("/formSottostrumento/economica3")
                return  aProgrammi.filter(item => ( item.Titolo === titolo && item.Categoria === categoria && 
                                        item.Ce2 === ce2&& item.Ce3 === ce3 )).length > 0
            },
            setSelectedCE2: function (titolo, categoria, ce2) {
                let modelHome = this.getView().getModel("modelHome")
                let aProgrammi = modelHome.getProperty("/formSottostrumento/economica2")
                return  aProgrammi.filter(item => ( item.Titolo === titolo && item.Categoria === categoria && 
                                        item.Ce2 === ce2 )).length > 0
            },
            setSelectedCategoria: function (titolo, categoria) {
                let modelHome = this.getView().getModel("modelHome")
                let aProgrammi = modelHome.getProperty("/formSottostrumento/categoria")
                return  aProgrammi.filter(item => ( item.Titolo === titolo && item.Categoria === categoria)).length > 0
            },
            setSelectedAmm: function (amm) {
                let modelHome = this.getView().getModel("modelHome")
                let aProgrammi = modelHome.getProperty("/formSottostrumento/dominio_sstr")
                return  aProgrammi.filter(item => ( item.Prctr === amm)).length > 0
            },
            setSelectedTitolo: function (titolo) {
                let modelHome = this.getView().getModel("modelHome")
                let aProgrammi = modelHome.getProperty("/formSottostrumento/titoli")
                return  aProgrammi.filter(item => ( item.Titolo === titolo)).length > 0
            },
            setSelectedMissioni: function (missione) {
                let modelHome = this.getView().getModel("modelHome")
                let aProgrammi = modelHome.getProperty("/formSottostrumento/missioni")
                return  aProgrammi.filter(item => ( item.Missione === missione)).length > 0
            },
            onSelectionChangeMCBDomSStr: function (oEvent) {
                //debugger
                let modelHome = this.getView().getModel("modelHome")
                const bAction = oEvent.getParameter("selected")
                const sArrayName = oEvent.getSource().getCustomData().find(cd => cd.getKey() === "selezione").getValue()
                let sPathItem = oEvent.getParameter("changedItem").getBindingContext("modelHome").getPath()
                let aItemsToUpdate = modelHome.getProperty("/formSottostrumento/" + sArrayName)
                if(bAction) {
                    aItemsToUpdate.push(modelHome.getProperty(sPathItem))
                } else {
                    const sKey = this.__getKeyMCBDomSStr(sArrayName)
                    let sIndexToRemove = aItemsToUpdate.findIndex( item => item[sKey] === oEvent.getParameter("changedItem").getKey())
                    aItemsToUpdate.splice(Number(sIndexToRemove), 1)
                }
            },
            __getKeyMCBDomSStr: function (key) { //metodo per l'estrazione delle chiavi degli array
                const keyValue = {
                    "amministrazioni": "Prctr",
                    "titoli": "CODICE_TITOLO",
                    "missioni": "CODICE_MISSIONE"
                }
                return keyValue[key]
            },
            __getPropertyByEntity: function (sEntity) {
                const propertyEntity =  {
                    "/Gest_PosFin_SH_AmministrazioniSet" : "dominio_sstrSet",
                    "/ZES_PROGRAMMA_SET": "programma_set",
                    "/ZES_MISSIONE_SET": "missione_set"
                }
            },
            __refreshItemsFilterDomSStr: function (sPath) {
                const modelHana = this.getOwnerComponent().getModel("sapHanaS2");
                const modelHome = this.getView().getModel("modelHome")
                let aMissioniAutoSelected = []
                let aTitoliAutoSelected = []
                let aProgrammaAutoSelected = []
                let aAmministrazioniAutoSelected = []
                let aTotMissioni = []
                let aTotTitoli = []
                let aTotCategorie = []
                let aMissioniPreSelected = []
                let aCategoriePreSelected = []
                let aTitoliPreSelected = []
                let aCategorieAutoSelected = []
                let aFilters = [new Filter("Fase", FilterOperator.EQ, "NV"),
                                new Filter("Anno", FilterOperator.EQ, modelHome.getProperty("/formSottostrumento/esercizio"))]
                switch (sPath) {
                    case "titoli": //la selezione di titoli ha effetto su Categoria/CE2/CE3
                        let aTitoli=  modelHome.getProperty("/formSottostrumento/" + sPath)
                        aTitoli.map(tit => {
                            aFilters.push(new Filter("Titolo", FilterOperator.EQ, tit.Titolo))
                        })
                        break;
                    case "categoria": //la selezione di categoria ha effetto su Titolo
                        let aCategoria=  modelHome.getProperty("/formSottostrumento/" + sPath)
                        aTitoliPreSelected = modelHome.getProperty("/formSottostrumento/titoli")

                        aTotTitoli = [...aCategoria, ...aTitoliPreSelected]
                        aTitoliAutoSelected = this.__removeDuplicate(aTotTitoli, "titoli")
                        modelHome.setProperty("/formSottostrumento/titoli", aTitoliAutoSelected)
                        break;
                    case "economica2": //la selezione di cla eco 2 ha effetto su Titolo/Categoria
                        let aEconomica2 =  modelHome.getProperty("/formSottostrumento/" + sPath)

                        //Titoli
                        aTitoliPreSelected = modelHome.getProperty("/formSottostrumento/titoli")
                        aTotTitoli = [...aEconomica2, ...aTitoliPreSelected]
                        aTitoliAutoSelected = this.__removeDuplicate(aTotTitoli, "titoli")
                        modelHome.setProperty("/formSottostrumento/titoli", aTitoliAutoSelected)

                        //Categorie
                        aCategoriePreSelected = modelHome.getProperty("/formSottostrumento/categoria")
                        aTotCategorie = [...aEconomica2, ...aCategoriePreSelected]
                        aCategorieAutoSelected = this.__removeDuplicate(aTotCategorie, "categoria")
                        modelHome.setProperty("/formSottostrumento/categoria", aCategorieAutoSelected)
                        break;
                    case "economica3": //la selezione di azioni ha effetto su Amministrazione/Missione/Programma
                        let aEconomica3 =  modelHome.getProperty("/formSottostrumento/" + sPath)
                        
                        //Titoli
                        aTitoliPreSelected = modelHome.getProperty("/formSottostrumento/titoli")
                        aTotTitoli = [...aEconomica3, ...aTitoliPreSelected]
                        aTitoliAutoSelected = this.__removeDuplicate(aTotTitoli, "titoli")
                        modelHome.setProperty("/formSottostrumento/titoli", aTitoliAutoSelected)

                        //Categorie
                        aCategoriePreSelected = modelHome.getProperty("/formSottostrumento/categoria")
                        aTotCategorie = [...aEconomica3, ...aCategoriePreSelected]
                        aCategorieAutoSelected = this.__removeDuplicate(aTotCategorie, "categoria")
                        modelHome.setProperty("/formSottostrumento/categoria", aCategorieAutoSelected)

                        //CE2
                        let aCE2PreSelected = modelHome.getProperty("/formSottostrumento/economica2")
                        let aTotCE2 = [...aEconomica3, ...aCE2PreSelected]
                        let aCE2AutoSelected = this.__removeDuplicate(aTotCE2, "ce2")
                        modelHome.setProperty("/formSottostrumento/economica2", aCE2AutoSelected)
                        break;
                    case "azioni": //la selezione di azioni ha effetto su Amministrazione/Missione/Programma
                        let aAzioni =  modelHome.getProperty("/formSottostrumento/" + sPath)
                        aMissioniPreSelected = modelHome.getProperty("/formSottostrumento/missioni")
                        let aProgrammiPreSelected = modelHome.getProperty("/formSottostrumento/programmi")

                        aTotMissioni = [...aAzioni, ...aMissioniPreSelected]
                        aMissioniAutoSelected = this.__removeDuplicate(aTotMissioni, "missioni")
                        modelHome.setProperty("/formSottostrumento/missioni", aMissioniAutoSelected)

                        let aTotProgrammi = [...aAzioni, ...aProgrammiPreSelected]
                        aProgrammaAutoSelected = this.__removeDuplicate(aTotProgrammi, "programma")
                        modelHome.setProperty("/formSottostrumento/programmi", aProgrammaAutoSelected)
                                    
                        aAmministrazioniAutoSelected = modelHome.getProperty("/formSottostrumento/dominio_sstrSet").filter(amm => aAzioni.filter(od => od.Prctr === amm.Prctr).length > 0);
                        modelHome.setProperty("/formSottostrumento/dominio_sstr", aAmministrazioniAutoSelected)
                        break;
                    case "programmi": //la selezione di azioni ha effetto su Amministrazione/Missione/Programma
                        let aProgrammi=  modelHome.getProperty("/formSottostrumento/" + sPath)
                        aMissioniPreSelected = modelHome.getProperty("/formSottostrumento/missioni")

                        aTotMissioni = [...aProgrammi, ...aMissioniPreSelected]
                        aMissioniAutoSelected = this.__removeDuplicate(aTotMissioni, "missioni")
                        modelHome.setProperty("/formSottostrumento/missioni", aMissioniAutoSelected)
                        break;
                    case "missioni": //la selezione di azioni ha effetto su Amministrazione/Missione/Programma
                        let aMissioni=  modelHome.getProperty("/formSottostrumento/" + sPath)
                        aMissioni.map(missioni => {
                            aFilters.push(new Filter("Missione", FilterOperator.EQ, missioni.Missione))
                        })
                        break;
                    default:
                        break;
                }

                // if(sPath === "titoli" || sPath === "categoria" ||sPath === "economica2" ||sPath === "economica3")
                //     modelHana.read("/Gest_SH1_TitoloSet", {
                //         filters: aFilters,
                //         success: (oData, res) => {
                //             //debugger
                //             //this.__setPropertyFiltriTitoloDomSStr(oData)
                //             this.__setPropertyHVChildren(sPath, oData)
                //             let modelHome = this.getView().getModel("modelHome")
                //             let aCategoriaAutoSelected = []
                //             let aTitoliAutoSelected = []
                //             let aCE2AutoSelected = []
                //             switch (sPath) {
                //                 case "categoria":
                //                     aTitoliAutoSelected = oData.results.filter((s => a => !(s.has(a.Titolo)) && (s.add(a.Titolo)))(new Set))
                //                                                     .filter(tit => tit.Titolo !== "");
                //                     modelHome.setProperty("/formSottostrumento/titoli", aTitoliAutoSelected)
                //                     break;
                //                 case "economica2":
                //                     aCategoriaAutoSelected = this.__removeDuplicate(oData.results, "categoria")
                //                                                     .filter(cat => cat.Titolo !== "");
                //                     modelHome.setProperty("/formSottostrumento/categoria", aCategoriaAutoSelected)
                //                     aTitoliAutoSelected = oData.results.filter((s => a => !(s.has(a.Titolo)) && (s.add(a.Titolo)))(new Set))
                //                                                     .filter(tit => tit.Titolo !== "");
                //                     modelHome.setProperty("/formSottostrumento/titoli", aTitoliAutoSelected)
                //                     break;
                //                 case "economica3":
                //                     aCE2AutoSelected = this.__removeDuplicate(oData.results, "ce2").filter(ce2 => ce2.Ce2 !== "");
                //                     modelHome.setProperty("/formSottostrumento/economica2", aCE2AutoSelected)

                //                     aCategoriaAutoSelected = this.__removeDuplicate(oData.results, "categoria")
                //                                                     .filter(cat => cat.Titolo !== "");
                //                     modelHome.setProperty("/formSottostrumento/categoria", aCategoriaAutoSelected)
                                    
                //                     aTitoliAutoSelected = oData.results.filter((s => a => !(s.has(a.Titolo)) && (s.add(a.Titolo)))(new Set))
                //                                                     .filter(tit => tit.Titolo !== "");
                //                     modelHome.setProperty("/formSottostrumento/titoli", aTitoliAutoSelected)
                //                     break;
                //                 default:
                //                     break;
                //             }
                //         },
                //         error: (err) => {
                //             //debugger
                //         }
                //     })
                // if(sPath === "azioni" || sPath === "programmi" || sPath === "missioni"){
                //     modelHana.read("/Gest_SH1_MissioneSet", {
                //         filters: aFilters,
                //         success: (oData, res) => {
                //             this.__setPropertyHVChildren(sPath, oData)
                //             let modelHome = this.getView().getModel("modelHome")
                //             let aMissioniAutoSelected = []
                //             let aProgrammaAutoSelected = []
                //             let aAmministrazioniAutoSelected = []
                            
                //             switch (sPath) {
                //                 case "azioni":
                //                     aMissioniAutoSelected = this.__removeDuplicate(oData.results, "missioni").filter(ms => ms.Missione !== "");
                //                     modelHome.setProperty("/formSottostrumento/missioni", aMissioniAutoSelected)

                //                     aProgrammaAutoSelected = this.__removeDuplicate(oData.results, "programma")
                //                                                     .filter(pr => pr.Programma !== "");
                //                     modelHome.setProperty("/formSottostrumento/programmi", aProgrammaAutoSelected)
                                    
                //                     aAmministrazioniAutoSelected = modelHome.getProperty("/formSottostrumento/dominio_sstrSet").filter(amm => oData.results.filter(od => od.Prctr === amm.Prctr).length > 0);
                //                     modelHome.setProperty("/formSottostrumento/dominio_sstr", aAmministrazioniAutoSelected)
                //                     break;
                //                 case "programmi":
                //                     aMissioniAutoSelected = this.__removeDuplicate(oData.results, "missioni").filter(ms => ms.Missione !== "");
                //                     modelHome.setProperty("/formSottostrumento/missioni", aMissioniAutoSelected)
                //                     break;
                //                 default:
                //                     break;
                //             }
                //         },
                //         error: (err) => {
                //             //debugger
                //         }
                //     })
                // }
                    
            },
            __setPropertyHVChildren: function (sPath, oData) {
                //Scelto un genitore, aggiorno lista dei figli
                let modelHome = this.getView().getModel("modelHome")

                // let resultTitoli = oData.results.filter((s => a => !(s.has(a.Titolo)) && (s.add(a.Titolo)))(new Set))
                //                     .filter(tit => tit.Titolo !== "");
                // modelHome.setProperty("/formSottostrumento/titolo_set", resultTitoli)
                if(sPath === "titoli"){
                    let resultCategoria = this.__removeDuplicate(oData.results, "categoria")
                                                .filter(cat => cat.Titolo !== "");
                    modelHome.setProperty("/formSottostrumento/categoria_set", resultCategoria)
                }
                if(sPath === "titoli" || sPath === "categoria" ) {
                    let resultCE2= this.__removeDuplicate(oData.results, "ce2")
                                                .filter(ce2 => ce2.Ce2 !== "");
                    modelHome.setProperty("/formSottostrumento/economica2_set", resultCE2)
                }
                if(sPath === "titoli" || sPath === "categoria" || sPath === "economica2") {
                    let resultCE3= this.__removeDuplicate(oData.results, "ce3")
                                                .filter(ce3 => ce3.Ce3 !== "");
                    modelHome.setProperty("/formSottostrumento/economica3_set", resultCE3)
                }
                if(sPath === "missioni"){
                    let resultProgramma= this.__removeDuplicate(oData.results, "programma")
                                                .filter(pr => pr.Programma !== "");
                    modelHome.setProperty("/formSottostrumento/programma_set", resultProgramma)

                    let resultAzioni = this.__removeDuplicate(oData.results, "azioni")
                                                .filter(pr => pr.Azione !== "");
                    modelHome.setProperty("/formSottostrumento/azione_set", resultAzioni)
                }
                if(sPath === "programmi"){
                    let resultAzioni = this.__removeDuplicate(oData.results, "azioni")
                    .filter(pr => pr.Azione !== "");
                    modelHome.setProperty("/formSottostrumento/azione_set", resultAzioni)
                }
            },
            __removeDuplicate(arr, property){
                let results = []
                switch (property) {
                    case "titoli":
                        for(let i = 0; i <  arr.length; i++){
                            if(results.filter(item => (item.Titolo === arr[i].Titolo)).length === 0)
                                results.push(arr[i])
                        }
                        break;
                    case "categoria":
                        for(let i = 0; i <  arr.length; i++){
                            if(results.filter(item => (item.Categoria === arr[i].Categoria && item.Titolo === arr[i].Titolo)).length === 0)
                                results.push(arr[i])
                        }
                        break;
                    case "ce2":
                        for(let i = 0; i <  arr.length; i++){
                            if(results.filter(item => item.Categoria === arr[i].Categoria && item.Titolo === arr[i].Titolo
                                            && item.Ce2 === arr[i].Ce2).length === 0)
                                results.push(arr[i])
                        }
                        break; 
                    case "ce3":
                        for(let i = 0; i <  arr.length; i++){
                            if(results.filter(item => item.Categoria === arr[i].Categoria && item.Titolo === arr[i].Titolo
                                            && item.Ce2 === arr[i].Ce2 && item.Ce3 === arr[i].Ce3).length === 0)
                                results.push(arr[i])
                        }
                        break; 
                    case "missioni":
                        for(let i = 0; i <  arr.length; i++){
                            if(results.filter(item => item.Missione === arr[i].Missione).length === 0)
                                results.push(arr[i])
                        }
                        break; 
                    case "programma":
                        for(let i = 0; i <  arr.length; i++){
                            if(results.filter(item => item.Missione === arr[i].Missione && item.Programma === arr[i].Programma).length === 0)
                                results.push(arr[i])
                        }
                        break; 
                    case "azioni":
                        for(let i = 0; i <  arr.length; i++){
                            if(results.filter(item => item.Missione === arr[i].Missione && item.Programma === arr[i].Programma
                                                && item.Azione === arr[i].Azione).length === 0)
                                results.push(arr[i])
                        }
                        break; 
                    case "esposizione":
                        for (let i = 0; i < arr.length; i++) {
                            if(results.filter(item => item.Esposizione === arr[i].Esposizione).length === 0)
                                    results.push(arr[i])  
                        }
                        break;
                    case "tipologia":
                        for (let i = 0; i < arr.length; i++) {
                            if(results.filter(item => item.Tipologia === arr[i].Tipologia).length === 0)
                                    results.push(arr[i])  
                        }
                        break;
                    case "visibilita":
                        for (let i = 0; i < arr.length; i++) {
                            if(results.filter(item => item.Reale === arr[i].Reale).length === 0)
                                    results.push(arr[i])  
                        }
                        break;
                    default:
                        break;
                }
                return results
            },
            __setPropertyFiltriTitoloDomSStr: function (oData) {
                let modelHome = this.getView().getModel("modelHome")
                // let resultAmm = oData.results.filter((s => a => !(s.has(a.Prctr)) && (s.add(a.Prctr)))(new Set))
                //                         .filter(amm => amm.Prctr !== "");
                // modelHome.setProperty("/formSottostrumento/dominio_sstrSet", resultAmm)

                let resultTitoli = oData.results.filter((s => a => !(s.has(a.Titolo)) && (s.add(a.Titolo)))(new Set))
                                    .filter(tit => tit.Titolo !== "");
                modelHome.setProperty("/formSottostrumento/titolo_set", resultTitoli)

                let resultCategoria = this.__removeDuplicate(oData.results, "categoria")
                                            .filter(cat => cat.Titolo !== "");
                modelHome.setProperty("/formSottostrumento/categoria_set", resultCategoria)

                let resultCE2= this.__removeDuplicate(oData.results, "ce2")
                                            .filter(ce2 => ce2.Ce2 !== "");
                modelHome.setProperty("/formSottostrumento/economica2_set", resultCE2)

                let resultCE3= this.__removeDuplicate(oData.results, "ce3")
                                            .filter(ce3 => ce3.Ce3 !== "");
                modelHome.setProperty("/formSottostrumento/economica3_set", resultCE3)
            },
            onSearchHVDomSStr: function (oEvent) {
                let sPropertyFilter= oEvent.getSource().getCustomData()[0].getValue()
                oEvent.getSource().getParent().getParent().getBinding("items").filter([new Filter(sPropertyFilter, FilterOperator.Contains, oEvent.getParameter("query"))])
            },
            __setPropertyFiltriMissioneDomSStr: function (oData) {
                let modelHome = this.getView().getModel("modelHome")

                let resultMissioni = oData.results.filter((s => a => !(s.has(a.Missione)) && (s.add(a.Missione)))(new Set))
                                    .filter(tit => tit.Missione !== "");
                modelHome.setProperty("/formSottostrumento/missione_set", resultMissioni)

                let resultProgramma = oData.results.filter((s => a => !(s.has(a.Programma)) && (s.add(a.Programma)))(new Set))
                                    .filter(tit => tit.Programma !== "");
                modelHome.setProperty("/formSottostrumento/programma_set", resultProgramma)

                // let resultAzione= oData.results.filter((s => a => !(s.has(a.Azione)) && (s.add(a.Azione)))(new Set))
                //                     .filter(tit => tit.Azione !== "");
                modelHome.setProperty("/formSottostrumento/azione_set", oData.results)
            },
            sorterHVDomSStr: function (a, b) {
                return Number(a) - Number(b)
            },
            sorterAmmByNumericCode: function (a,b) {
                const subStrAmm1 = Number(a.substring(1, a.length))
                const subStrAmm2 = Number(b.substring(1, a.length))
                return subStrAmm1 - subStrAmm2;
            },
            __checkDominioSStr: function (obj) {
                let checkMissioniMass = false
                let checkTitoloMass = false
                let modelHome = this.getView().getModel("modelHome")
                let filtersDom =   modelHome.getProperty("/formSottostrumento")
                let checkCe3 = false
                let checkCe2 = false
                let checkCategoria = false
                let checkTitoli = false
                let checkMissione = false
                let checkProgramma = false
                let checkAzione = false
                let checkAmministrazione = false
                let checkTipologiaVariazioni = false
                let checkCBAuth = false
                let checkEsposizione = false
                
                if(obj.DomTitolo.results.length > 0) {
                    if(filtersDom.economica3.length > 0) { //cE3
                        for (let i = 0; i < filtersDom.economica3.length; i++){
                            let currentFilter = filtersDom.economica3[i]
                            let itemPresentCE3 = obj.DomTitolo.results.filter(item => item.Titolo === currentFilter.Titolo && item.Categoria === currentFilter.Categoria
                                                    && item.Ce2 === currentFilter.Ce2 && item.Ce3 === currentFilter.Ce3)
                            if(itemPresentCE3.length > 0)
                                checkCe3 = true
                        }
                    } else {
                        checkCe3 = true
                    }
                    if(filtersDom.economica2.length > 0){ //cE2
                           
                        for (let i = 0; i < filtersDom.economica2.length; i++){
                            let currentFilter = filtersDom.economica2[i]
                            let itemPresentCE2 = obj.DomTitolo.results.filter(item => item.Titolo === currentFilter.Titolo && item.Categoria === currentFilter.Categoria
                                                    && item.Ce2 === currentFilter.Ce2)
                            if(itemPresentCE2.length > 0)
                                checkCe2 = true
                        }
                   } else {
                        checkCe2 = true
                   }
                   if(filtersDom.categoria.length > 0){ //Categoria
                            
                        for (let i = 0; i < filtersDom.categoria.length; i++){
                            let currentFilter = filtersDom.categoria[i]
                            let itemPresentCategoria = obj.DomTitolo.results.filter(item => item.Titolo === currentFilter.Titolo && item.Categoria === currentFilter.Categoria)
                            if(itemPresentCategoria.length > 0)
                                checkCategoria = true
                        }
                    } else {
                        checkCategoria = true
                    }
                    if(filtersDom.titoli.length > 0){ //Titolo
                        for (let i = 0; i < filtersDom.titoli.length; i++){
                            let currentFilter = filtersDom.titoli[i]
                            let itemPresentTitolo = obj.DomTitolo.results.filter(item => item.Titolo === currentFilter.Titolo )
                            if(itemPresentTitolo.length > 0)
                            checkTitoli = true
                        }
                    } else {
                        checkTitoli = true
                    } 
                } else {
                   checkTitoloMass = true
                }


                if(checkCe3 === true && checkCe2 === true && checkCategoria === true && checkTitoli === true){
                    checkTitoloMass = true
                }


                if(obj.DomMissione.results.length > 0) {
                    if(filtersDom.azioni.length > 0) { //cE3
                        for (let i = 0; i < filtersDom.azioni.length; i++){
                            let currentFilter = filtersDom.azioni[i]
                            let itemPresentAzioni = obj.DomMissione.results.filter(item => item.Azione  === currentFilter.Azione && item.Programma === item.Programma &&
                                                                                            item.Missione  === currentFilter.Missione && item.Prctr === currentFilter.Prctr)
                            if(itemPresentAzioni.length > 0)
                                checkAzione = true
                        }
                    } else {
                        checkAzione = true
                    }
                    if(filtersDom.programmi.length > 0){
                        for (let i = 0; i < filtersDom.programmi.length; i++){
                            let currentFilter = filtersDom.programmi[i]
                            let itemPresentProgramma = obj.DomMissione.results.filter(item =>  item.Programma === item.Programma &&
                                                                                                item.Missione  === currentFilter.Missione)
                            if(itemPresentProgramma.length > 0)
                                checkProgramma = true
                        }
                    } else {
                        checkProgramma = true
                    }
                    if(filtersDom.missioni.length > 0){
                        for (let i = 0; i < filtersDom.missioni.length; i++){
                            let currentFilter = filtersDom.missioni[i]
                            let itemPresentMissione = obj.DomMissione.results.filter(item => item.Missione  === currentFilter.Missione)
                            if(itemPresentMissione.length > 0)
                                checkMissione = true
                        }
                    } else {
                        checkMissione = true
                    }
                } else {
                    checkMissioniMass = true
                }

                if(checkAzione === true && checkProgramma === true && checkMissione === true){
                    checkMissioniMass = true
                }

                if(filtersDom.dominio_sstr.length > 0) { //Amministrazioni escluse da quelle presenti in Azioni
                    for (let i = 0; i < filtersDom.dominio_sstr.length; i++){
                        let currentFilter = filtersDom.dominio_sstr[i]
                        let itemPresentAmm = obj.DomAmministrazione.results.filter(item => item.Prctr  === currentFilter.Prctr)
                        if(itemPresentAmm.length > 0)
                            checkAmministrazione = true
                    }
                } else {
                    checkAmministrazione = true
                }

                if(obj.DomInterno.results.length > 0){
                    // obj.DomInterno.results = obj.DomInterno.results.filter(int => int.DomEs === "S")
                    if(obj.DomInterno.results.filter(int => int.DomEs === "S" || int.DomEs === "N").length > 0) {
                        checkEsposizione = true
                    }
                } else {
                    checkEsposizione = true
                }
                
                //Controllo scelta Tipologia Variazioni
                if(obj.DomInterno.results.length > 0) {
                        if(filtersDom.var_struttura === true) {
                            if(obj.DomInterno.results.filter(ti => ti.DomTpvar === "S" ).length > 0)
                                checkTipologiaVariazioni = true
                        }
                        if(filtersDom.var_contabili === true){
                            if(obj.DomInterno.results.filter(ti => ti.DomTpvar === "C" ).length > 0)
                                checkTipologiaVariazioni = true
                        }

                        if(filtersDom.var_struttura === false && filtersDom.var_contabili === false)
                            checkTipologiaVariazioni = true
                    //}
                } else {
                    
                    checkTipologiaVariazioni = true
                }

                //Controllo scelta Autorizzazioni CheckBox
                if(obj.DomInterno.results.length > 0 ){
                    if(filtersDom.FB && filtersDom.FL && filtersDom.OI) {
                        if(obj.DomInterno.results.filter( item => item.FlagFb === filtersDom.FB  &&
                                                            item.FlagFl === filtersDom.FL && 
                                                            item.FlagOi === filtersDom.OI ).length > 0)
                            checkCBAuth = true
                    } else {
                        if(filtersDom.FB && filtersDom.FL )
                            if(obj.DomInterno.results.filter( item => item.FlagFb === filtersDom.FB &&
                                                                                    item.FlagFl === filtersDom.FL ).length > 0)
                                    checkCBAuth = true
                        if(filtersDom.FL && filtersDom.OI)
                            if(obj.DomInterno.results.filter( item => item.FlagFl === filtersDom.FL &&
                                                                    item.FlagOi === filtersDom.OI ).length > 0)
                                    checkCBAuth = true
                        if(filtersDom.FB && filtersDom.OI)
                            if(obj.DomInterno.results.filter( item => item.FlagFb === filtersDom.FB &&
                                                                    item.FlagOi === filtersDom.OI ).length > 0)
                                    checkCBAuth = true
                        if(filtersDom.FB)
                            if(obj.DomInterno.results.filter( item => item.FlagFb === filtersDom.FB ).length > 0)
                                    checkCBAuth = true
                        if(filtersDom.FL)
                            if(obj.DomInterno.results.filter( item => item.FlagFl === filtersDom.FL ).length > 0)
                                    checkCBAuth = true
                        if(filtersDom.OI)
                            if(obj.DomInterno.results.filter( item => item.FlagOi === filtersDom.OI ).length > 0)
                                    checkCBAuth = true 
                        if(filtersDom.FB === false && filtersDom.FL === false && filtersDom.OI === false)
                                    checkCBAuth = true   
                    }
                } else {
                    
                    checkCBAuth = true
                }

                if(checkMissioniMass === true && checkTitoloMass === true && checkAmministrazione === true && checkTipologiaVariazioni === true 
                            && checkCBAuth === true && checkEsposizione === true){
                    return obj
                } else {
                    return null
                }

            },
            __checkDominioSStr_old: function (obj) {
                let checkMissioniMass = false
                let checkTitoloMass = false
                let modelHome = this.getView().getModel("modelHome")
                let filtersDom =   modelHome.getProperty("/formSottostrumento")
                let checkCe3 = false
                let checkCe2 = false
                let checkCategoria = false
                let checkTitoli = false
                let checkMissione = false
                let checkProgramma = false
                let checkAzione = false
                let checkAmministrazione = false
                let checkTipologiaVariazioni = false
                let checkCBAuth = false
                let checkEsposizione = false

                //checkMissioni
                // if(obj.ToTitolo.results.length > 0) {
                //     if(filtersDom.economica3.length > 0) { //cE3
                        
                //         for (let i = 0; i < filtersDom.economica3.length; i++){
                //             let currentFilter = filtersDom.economica3[i]
                //             let itemPresentCE3 = obj.ToTitolo.results.filter(item => item.Titolo === currentFilter.Titolo && item.Categoria === currentFilter.Categoria
                //                                     && item.Ce2 === currentFilter.Ce2 && item.Ce3 === currentFilter.Ce3)
                //             if(itemPresentCE3.length > 0)
                //                 checkCe3 = true
                //         }
                //     } else {
                //         checkCe3 = true
                //         if(filtersDom.economica2.length > 0){
                           
                //             for (let i = 0; i < filtersDom.economica2.length; i++){
                //                 let currentFilter = filtersDom.economica2[i]
                //                 let itemPresentCE2 = obj.ToTitolo.results.filter(item => item.Titolo === currentFilter.Titolo && item.Categoria === currentFilter.Categoria
                //                                         && item.Ce2 === currentFilter.Ce2)
                //                 if(itemPresentCE2.length > 0)
                //                     checkCe2 = true
                //             }
                //         } else {
                //             checkCe2 = true
                //             if(filtersDom.categoria.length > 0){
                            
                //                 for (let i = 0; i < filtersDom.categoria.length; i++){
                //                     let currentFilter = filtersDom.categoria[i]
                //                     let itemPresentCategoria = obj.ToTitolo.results.filter(item => item.Titolo === currentFilter.Titolo && item.Categoria === currentFilter.Categoria)
                //                     if(itemPresentCE2.length > 0)
                //                         checkCategoria = true
                //                 }
                //             } else {
                //                 checkCategoria = true
                //                 if(filtersDom.titoli.length > 0){
                //                     for (let i = 0; i < filtersDom.titoli.length; i++){
                //                         let currentFilter = filtersDom.titoli[i]
                //                         let itemPresentTitolo = obj.ToTitolo.results.filter(item => item.Titolo === currentFilter.Titolo )
                //                         if(itemPresentTitolo.length > 0)
                //                         checkTitoli = true
                //                     }
                //                 } else {
                //                     checkTitoli = true
                //                 }
                //             }
                //         }
                //     }
                // } else {
                //     checkTitoloMass = true
                // }
                if(obj.DomTitolo.results.length > 0) {
                    if(filtersDom.economica3.length > 0) { //cE3
                        for (let i = 0; i < filtersDom.economica3.length; i++){
                            let currentFilter = filtersDom.economica3[i]
                            let itemPresentCE3 = obj.DomTitolo.results.filter(item => item.Titolo === currentFilter.Titolo && item.Categoria === currentFilter.Categoria
                                                    && item.Ce2 === currentFilter.Ce2 && item.Ce3 === currentFilter.Ce3)
                            if(itemPresentCE3.length > 0)
                                checkCe3 = true
                        }
                    } else {
                        checkCe3 = true
                    }
                    if(filtersDom.economica2.length > 0){ //cE2
                           
                        for (let i = 0; i < filtersDom.economica2.length; i++){
                            let currentFilter = filtersDom.economica2[i]
                            let itemPresentCE2 = obj.DomTitolo.results.filter(item => item.Titolo === currentFilter.Titolo && item.Categoria === currentFilter.Categoria
                                                    && item.Ce2 === currentFilter.Ce2)
                            if(itemPresentCE2.length > 0)
                                checkCe2 = true
                        }
                   } else {
                        checkCe2 = true
                   }
                   if(filtersDom.categoria.length > 0){ //Categoria
                            
                        for (let i = 0; i < filtersDom.categoria.length; i++){
                            let currentFilter = filtersDom.categoria[i]
                            let itemPresentCategoria = obj.DomTitolo.results.filter(item => item.Titolo === currentFilter.Titolo && item.Categoria === currentFilter.Categoria)
                            if(itemPresentCategoria.length > 0)
                                checkCategoria = true
                        }
                    } else {
                        checkCategoria = true
                    }
                    if(filtersDom.titoli.length > 0){ //Titolo
                        for (let i = 0; i < filtersDom.titoli.length; i++){
                            let currentFilter = filtersDom.titoli[i]
                            let itemPresentTitolo = obj.DomTitolo.results.filter(item => item.Titolo === currentFilter.Titolo )
                            if(itemPresentTitolo.length > 0)
                            checkTitoli = true
                        }
                    } else {
                        checkTitoli = true
                    } 
                } else {
                   checkTitoloMass = true
                }


                if(checkCe3 === true && checkCe2 === true && checkCategoria === true && checkTitoli === true){
                    checkTitoloMass = true
                }

                // if(obj.ToMissione.results.length > 0) {
                //     if(filtersDom.azioni.length > 0) { //cE3
                //         for (let i = 0; i < filtersDom.azioni.length; i++){
                //             let currentFilter = filtersDom.azioni[i]
                //             let itemPresentAzioni = obj.ToMissione.results.filter(item => item.Azione  === currentFilter.Azione && item.Programma === item.Programma &&
                //                                                                           item.Missione  === currentFilter.Missione && item.Prctr === currentFilter.Prctr)
                //             if(itemPresentAzioni.length > 0)
                //                 checkAzione = true
                //         }
                //     } else {
                //         checkAzione = true
                //         if(filtersDom.programmi.length > 0){
                //             for (let i = 0; i < filtersDom.programmi.length; i++){
                //                 let currentFilter = filtersDom.programmi[i]
                //                 let itemPresentProgramma = obj.ToMissione.results.filter(item =>  item.Programma === item.Programma &&
                //                                                                                     item.Missione  === currentFilter.Missione)
                //                 if(itemPresentProgramma.length > 0)
                //                     checkProgramma = true
                //             }
                //         } else {
                //             checkProgramma = true
                //             if(filtersDom.missioni.length > 0){
                //                 for (let i = 0; i < filtersDom.missioni.length; i++){
                //                     let currentFilter = filtersDom.missioni[i]
                //                     let itemPresentMissione = obj.ToMissione.results.filter(item => item.Missione  === currentFilter.Missione)
                //                     if(itemPresentMissione.length > 0)
                //                         checkMissione = true
                //                 }
                //             } else {
                //                 checkMissione = true
                //             }
                //         }
                //     }
                // } else {
                //     checkMissioniMass = true
                // }

                if(obj.DomMissione.results.length > 0) {
                    if(filtersDom.azioni.length > 0) { //cE3
                        for (let i = 0; i < filtersDom.azioni.length; i++){
                            let currentFilter = filtersDom.azioni[i]
                            let itemPresentAzioni = obj.DomMissione.results.filter(item => item.Azione  === currentFilter.Azione && item.Programma === item.Programma &&
                                                                                            item.Missione  === currentFilter.Missione && item.Prctr === currentFilter.Prctr)
                            if(itemPresentAzioni.length > 0)
                                checkAzione = true
                        }
                    } else {
                        checkAzione = true
                    }
                    if(filtersDom.programmi.length > 0){
                        for (let i = 0; i < filtersDom.programmi.length; i++){
                            let currentFilter = filtersDom.programmi[i]
                            let itemPresentProgramma = obj.DomMissione.results.filter(item =>  item.Programma === item.Programma &&
                                                                                                item.Missione  === currentFilter.Missione)
                            if(itemPresentProgramma.length > 0)
                                checkProgramma = true
                        }
                    } else {
                        checkProgramma = true
                    }
                    if(filtersDom.missioni.length > 0){
                        for (let i = 0; i < filtersDom.missioni.length; i++){
                            let currentFilter = filtersDom.missioni[i]
                            let itemPresentMissione = obj.DomMissione.results.filter(item => item.Missione  === currentFilter.Missione)
                            if(itemPresentMissione.length > 0)
                                checkMissione = true
                        }
                    } else {
                        checkMissione = true
                    }
                } else {
                    checkMissioniMass = true
                }

                if(checkAzione === true && checkProgramma === true && checkMissione === true){
                    checkMissioniMass = true
                }

                // let aAmminIsolate = filtersDom.dominio_sstr.map(amm => {  //Calcolo Amministrazioni non determinate da Azioni
                //     if(filtersDom.azioni.filter(az => az.Prctr !== amm.Prctr).length > 0)
                //         return amm
                // }).filter(res => res !== undefined)

                if(filtersDom.dominio_sstr.length > 0) { //Amministrazioni escluse da quelle presenti in Azioni
                    for (let i = 0; i < filtersDom.dominio_sstr.length; i++){
                        let currentFilter = filtersDom.dominio_sstr[i]
                        let itemPresentAmm = obj.DomAmministrazione.results.filter(item => item.Prctr  === currentFilter.Prctr)
                        if(itemPresentAmm.length > 0)
                            checkAmministrazione = true
                    }
                } else {
                    checkAmministrazione = true
                }

                if(obj.DomInterno.results.length > 0){
                    obj.DomInterno.results = obj.DomInterno.results.filter(int => int.DomEs === "S")
                    if(obj.DomInterno.results.length > 0) {
                        checkEsposizione = true
                    }
                } else {
                    checkEsposizione = true
                }
                //Controllo scelta Tipologia Variazioni
                if(obj.DomInterno.results.length > 0) {
                    if(modelHome.getProperty("/formSottostrumento/var_struttura") === true || modelHome.getProperty("/formSottostrumento/var_contabili") === true){
                        if(obj.DomInterno.results.filter(ti => ti.TipologiaVariazioni === "S" || ti.TipologiaVariazioni === "C").length > 0)
                            checkTipologiaVariazioni = true
                    } else {
                        if(modelHome.getProperty("/formSottostrumento/var_struttura") === true) {
                            if(obj.DomInterno.results.filter(ti => ti.TipologiaVariazioni === "S" ).length > 0)
                                checkTipologiaVariazioni = true
                        }
                        if(modelHome.getProperty("/formSottostrumento/var_contabili") === true){
                            if(obj.DomInterno.results.filter(ti => ti.TipologiaVariazioni === "C" ).length > 0)
                                checkTipologiaVariazioni = true
                        }

                        if(modelHome.getProperty("/formSottostrumento/var_struttura") === false && modelHome.getProperty("/formSottostrumento/var_contabili") === false)
                            checkTipologiaVariazioni = true
                    }
                } else {
                    if(modelHome.getProperty("/formSottostrumento/var_struttura") === true || modelHome.getProperty("/formSottostrumento/var_contabili") === true) {
                        checkTipologiaVariazioni = false
                    } else {
                        checkTipologiaVariazioni = true
                    }
                }

                //Controllo scelta Autorizzazioni CheckBox
                if(obj.DomInterno.results.length > 0 ){
                    if(modelHome.getProperty("/formSottostrumento/FB") && modelHome.getProperty("/formSottostrumento/FL") && modelHome.getProperty("/formSottostrumento/OI")) {
                        if(obj.DomInterno.results.filter( item => item.FlagFb === modelHome.getProperty("/formSottostrumento/FB") &&
                                                            item.FlagFl === modelHome.getProperty("/formSottostrumento/FL") && 
                                                            item.FlagOi === modelHome.getProperty("/formSottostrumento/OI") ).length > 0)
                            checkCBAuth = true
                    } else {
                        if(modelHome.getProperty("/formSottostrumento/FB") && modelHome.getProperty("/formSottostrumento/FL") )
                            if(obj.DomInterno.results.filter( item => item.FlagFb === modelHome.getProperty("/formSottostrumento/FB") &&
                                                                                    item.FlagFl === modelHome.getProperty("/formSottostrumento/FL") ).length > 0)
                                    checkCBAuth = true
                        if(modelHome.getProperty("/formSottostrumento/FL") && modelHome.getProperty("/formSottostrumento/OI"))
                            if(obj.DomInterno.results.filter( item => item.FlagFl === modelHome.getProperty("/formSottostrumento/FL") &&
                                                                    item.FlagOi === modelHome.getProperty("/formSottostrumento/OI") ).length > 0)
                                    checkCBAuth = true
                        if(modelHome.getProperty("/formSottostrumento/FB") && modelHome.getProperty("/formSottostrumento/OI"))
                            if(obj.DomInterno.results.filter( item => item.FlagFb === modelHome.getProperty("/formSottostrumento/FB") &&
                                                                    item.FlagOi === modelHome.getProperty("/formSottostrumento/OI") ).length > 0)
                                    checkCBAuth = true
                        if(modelHome.getProperty("/formSottostrumento/FB"))
                            if(obj.DomInterno.results.filter( item => item.FlagFb === modelHome.getProperty("/formSottostrumento/FB") ).length > 0)
                                    checkCBAuth = true
                        if(modelHome.getProperty("/formSottostrumento/FL"))
                            if(obj.DomInterno.results.filter( item => item.FlagFl === modelHome.getProperty("/formSottostrumento/FL") ).length > 0)
                                    checkCBAuth = true
                        if(modelHome.getProperty("/formSottostrumento/OI"))
                            if(obj.DomInterno.results.filter( item => item.FlagOi === modelHome.getProperty("/formSottostrumento/OI") ).length > 0)
                                    checkCBAuth = true 
                        if(modelHome.getProperty("/formSottostrumento/FB") === false && modelHome.getProperty("/formSottostrumento/FL") === false && modelHome.getProperty("/formSottostrumento/OI") === false)
                                    checkCBAuth = true   
                    }
                } else {
                    if(modelHome.getProperty("/formSottostrumento/FB") === true || modelHome.getProperty("/formSottostrumento/FL") === true 
                        || modelHome.getProperty("/formSottostrumento/OI") === true){
                            checkCBAuth = false
                    } else {
                        checkCBAuth = true
                    }
                }

                if(checkMissioniMass === true && checkTitoloMass === true && checkAmministrazione === true && checkTipologiaVariazioni === true 
                            && checkCBAuth === true && checkEsposizione === true){
                    return obj
                } else {
                    return null
                }

            },
			onHelpValueStrumento: async function(e) {
				// var index = e.getSource().getId().split('-')[12];
				// this.getView().getModel("sPathIndexModel").getData().sPathSottostrumento = index;

                const globalModel = this.getView().getModel("globalModel");
				const t = this.getView().getModel("modelHome");
				const n = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/sap/ZSS4_STRUMENTO_SRV/");
				var aFilters = [];
				aFilters.push(new Filter("Fikrs", FilterOperator.EQ, "S001"));
				aFilters.push(new Filter("TipoStr", FilterOperator.EQ, "54"));
				aFilters.push(new Filter("AnnoStr", FilterOperator.EQ, globalModel.getProperty("/ANNO")));
				if (t.getData().Sottostrumento) {
					aFilters.push(new Filter("CodiceStrumento", FilterOperator.EQ, t.getData().infoSottoStrumento.CodiceStrumento));
				}
				t.setProperty("/formSottostrumento/Strumento", []);
				t.setProperty("/busyAuth", true);

				// let a = [new Filter("Fikrs", FilterOperator.EQ, "S001")];
				// a.push(new Filter("CodiceTitolo", FilterOperator.EQ, sCodiceTitolo));
				// a = this._setFiltersForm(a, t);
				// this.openHVAutorizzazione("TableRicercaAuth", "TableRicercaAuth");
				n.read("/ZCOBI_I_STRUMENTO", {
					urlParameters: {
						$expand: "to_SottoStrumenti"
					},
					filters: aFilters,
					success: e => {
						// if (t.getProperty("/formAutorizzazione/Item/TipoAut")) e.results = e.results.filter(e => e.Tipo === t.getProperty(
						// 	"/formAutorizzazione/Item/TipoAut"));
						// t.setProperty("/formAutorizzazione/resultsAuth", e.results);
						// t.setProperty("/formAutorizzazione/resultsAuth", e.results);
						t.setProperty("/Strumento/", e.results);
						t.setProperty("/busyAuth", false)
					},
					error: e => {
						s.error("Errore nel recupero dei Sottostrumenti");
						t.setProperty("/busyAuth", false)
					}
				})

				if (!this.oDialogSottostrumento) {
					Fragment.load({
						name: "zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.TableStrumento",
						controller: this
					}).then(e => {
						this.oDialogSottostrumento = e;
						this.getView().addDependent(e);
						this.oDialogSottostrumento.open()
					})
				} else {
					this.oDialogSottostrumento.open()
				}
			},
			onConfirmTableStrumento: function(oEvent) {
				var sItemSelected = oEvent.getParameters().selectedItem.getBindingContext("modelHome").getObject();

                if(sItemSelected.StatoStr === "01"){
                    MessageBox.warning(this.getText("noStrumentoChiuso"))
                    this.onResetSStr();
                    return;
                }

				var sNumeroStr = sItemSelected.NumeroStr;
				var sNumeroStrCompleto = sItemSelected.CodiceStrumento;
				var sModelReg = this.getView().getModel("modelHome");
				var sItems = sModelReg.getData();
				sModelReg.setProperty("/infoStrumento", sItemSelected)
				sModelReg.setProperty("/Strumento", sItemSelected)
				sItems.NStrumento = sNumeroStr;
				sItems.Strumento = sNumeroStr;
				sItems.CodSTR = sItemSelected.DescrSiglaTipoStr + " - " + sNumeroStr;
				sItems.NStrumentoCompleto = sNumeroStrCompleto;
				sModelReg.updateBindings(true);
				this.getView().byId("idSstr").setEnabled(true);
				this.oDialogSottostrumento.destroy();
				this.oDialogSottostrumento=undefined;
			},
        });
    });