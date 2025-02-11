sap.ui.define([
	"sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
    "sap/ui/core/format/DateFormat",
    "sap/m/MessageBox",
    'sap/ui/export/Spreadsheet',
    "../model/formatter",
    "sap/ui/core/routing/History",
    "z_s4_crosslock/crosslock/controls/Lock",
    "zsap/com/r3/cobi/s4/gestposfinnv/model/models",
    "zsap/com/r3/cobi/s4/gestposfinnv/extLib/xlsx.min"
], function(
	Controller, JSONModel, Filter, FilterOperator, DateFormat, MessageBox, Spreadsheet, formatter, History, Lock, models
) {
	"use strict";

	return Controller.extend("zsap.com.r3.cobi.s4.gestposfinnv.controller.BaseController", {
        Lock: Lock,
        formatter: formatter,
        getRouter : function () {
            return this.getOwnerComponent().getRouter();
        },
        returnObjBinded: function(model, oEvent) {
            return oEvent.getSource().getBindingContext(model).getObject()
        },

        __getEntityMatchCode: function (key) {
            let oCodificaEntity = {
                "Amm": "/Gest_PosFin_SH_AmministrazioniSet"
            }
            let oCodificaProperty = {
                "Amm": "/helpValueAmministrazioni"
            }
            let oCodificaFilters = {
                "Amm":[
                    new Filter("Anno", FilterOperator.EQ, (new Date(new Date().setFullYear(new Date().getFullYear() + 1))).getFullYear().toString()),
                    new Filter("Fase", FilterOperator.EQ, "FORM")
                ]
            }
            return {entity: oCodificaEntity[key],  property: oCodificaProperty[key], filters: oCodificaFilters[key] }
        },
        __getValueHelpData: function (key) {
            let oCodifica = this.__getEntityMatchCode(key)
            let modelPosFin = this.getView().getModel("modelPosFin")
            let oModel = this.getOwnerComponent().getModel("sapHanaS2")

            oModel.read(oCodifica.entity, {
                filters: oCodifica.filters,
                success: (odata) => {
                    modelPosFin.setProperty(oCodifica.property, odata.results)
                }
            })
            
        },
        __setMultiFiltersMissione: function (data, arrProperty, a) {
            return new Filter({
                filters: function () {
                    let andFilters = []
                     for(let i =0; i < data.length; i++) {
                        let currentData = data[i]
                        andFilters.push(new Filter({
                            // filters: [
                            //     ... arrProperty.map((prop) => {
                            //         return new Filter(prop, FilterOperator.EQ, currentData[prop])
                            //     })
                            // ],
                            filters: function() {
                                let aMultiFilters = []
                                for(let j=0; j < arrProperty.length; j++) {
                                    if(currentData[arrProperty[j]])
                                        aMultiFilters.push(new Filter(arrProperty[j], FilterOperator.EQ, currentData[arrProperty[j]]))
                                }
                                return aMultiFilters
                            }(),
                            and: true
                        }))
                     }
                     return andFilters
                }(),
                and: false,
              })
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
        __getDataPromise: function (sPath, filters, modelHana, oUrlParameters = null) {
          return new Promise ((resolve, reject) => {
            modelHana.read(sPath, {
                urlParameters: oUrlParameters,
                filters: filters,
                success: (oData) => {
                    resolve(oData.results)
                },
                error: (err) => {
                    debugger
                    resolve(err)
                },
            })
          })  
        },
        __getDataPromisePosConExp: function (sPath, filters, modelHana, oUrlParameters = null) {
          return new Promise ((resolve, reject) => {
            modelHana.read(sPath, {
                urlParameters: oUrlParameters,
                filters: filters,
                success: (oData) => {
                    resolve(oData)
                }
            })
          })  
        },
        __getDataPromisePerFoglio: function (sPath, filters, modelHana, expand) {
          return new Promise ((resolve, reject) => {
            modelHana.read(sPath, {
                //urlParameters: oUrlParameters,
                //urlParameters: {"$expand": "NAV_COFOG,NAV_ELENCHI,NAV_IRAP"},
                urlParameters : !expand ? {} : expand,
                filters: filters,
                success: (oData) => {
                    resolve(oData.results)
                },
                error: (err) => {
                    if(err.statusCode === "404" && err.statusText === "Not Found"){
                        resolve([])
                    }		
                }
            })
          })  
        },
        __setDataPromiseSave: function (sPath, model, oParams, payload) {
          return new Promise ((resolve, reject) => {
            model.create(sPath, payload ,{
                success: (oData) => {
                    resolve({
                        success : true,
                        entity : oData
                    })
                },
                error:(err) => {
                    resolve({
                        success : false,
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
                        state: false,
                        modelPosFin: oParams.modelPosFin,
                        onOk: true
                    })
                },
            })
          })  
        },
        __setDataPromiseSaveBW: function (sPath, model, oParams, payload) {
          return new Promise ((resolve, reject) => {
            model.create(sPath, payload ,{
                success: (oData) => {
                    resolve({
                        success : true,
                        entity : oData
                    })
                },
                error:(err) => {
                    resolve({
                        success : false,
                        error : err
                    })
                },
            })
          })  
        },
        __setDataPromiseCheck: function (sPath, model, payload) {
          return new Promise ((resolve, reject) => {
            model.create(sPath, payload ,{
                success: (oData) => {
                    resolve({
                        success : true,
                        entity : oData
                    })
                },
                error:(err) => {
                    resolve({
                        success : false,
                        error : err
                    })
                },
            })
          })  
        },
        __getKeyPromise: function (sPath, modelHana, urlParameters=null) {
          return new Promise ((resolve, reject) => {
            modelHana.read(sPath, {
                urlParameters: urlParameters,
                success: (oData) => {
                    resolve(oData)
                },
                error: (err) =>{
                    reject(err)
                }
            })
          })  
        },
        __getAnnoFaseProcessoMacroFase: function () {
            let modelTopologiche = this.getOwnerComponent().getModel("sapHanaS2Tipologiche")  
            var that = this;
            return new Promise((resolve, reject) => {
              modelTopologiche.read("/ZES_CAL_FIN_SET",{
                  filters: [new Filter("FASE", FilterOperator.EQ, "F"), new Filter("SEM_OBJ", FilterOperator.EQ, "Z_S4_GPOSFINNV")],
                  success: (oData) => {
                    resolve({
                        ANNO : oData.results[0].ANNO,
                        //DDTEXT : oData.results[0].DDTEXT,
                        DDTEXT : oData.results[0].FASE === "F" ? "Formazione" : oData.results[0].DDTEXT,
                        STAT_FASE : oData.results[0].STAT_FASE === "0" ? "Disegno di legge di bilancio" : oData.results[0].DDTEXT,
                    })
                    that.getOwnerComponent().setModel(new JSONModel({
                        ANNO : oData.results[0].ANNO,
                        DDTEXT : oData.results[0].FASE === "F" ? "Formazione" : oData.results[0].DDTEXT,
                        STAT_FASE : oData.results[0].STAT_FASE === "0" ? "Disegno di legge di bilancio" : oData.results[0].DDTEXT,
                    }), "globalModel")
                    that.setLabelQuadroTabelleModel(oData.results[0].ANNO);
                    //resolve(ritorno)
                  },
                  error: (err) => {
                      reject(err)
                  }
              })
            })
          },
          setLabelQuadroTabelleModel: function (anno) {
            let annoParse =parseInt(
                anno
            ) 
            const anni = {
              annoCp1: annoParse.toString(),
              annoCp2: (annoParse + 1).toString(),
              annoCp3: (annoParse + 2).toString(),
              annoCs1: annoParse.toString(),
              annoCs2: (annoParse + 1).toString(),
              annoCs3: (annoParse + 2).toString()
            };
            this.getOwnerComponent().setModel(new JSONModel(anni), "labelQuadroTabelle");
    
          },
        __getAnnoFase: function () {
          let modelTopologiche = this.getOwnerComponent().getModel("sapHanaS2Tipologiche")  
          return new Promise((resolve, reject) => {
            modelTopologiche.read("/ZES_CAL_FIN_SET",{
                filters: [new Filter("FASE", FilterOperator.EQ, "F"), new Filter("SEM_OBJ", FilterOperator.EQ, "Z_S4_GPOSFINNV")],
                success: (oData) => {
                    resolve(oData.results[0].ANNO)
                },
                error: (err) => {
                    reject(err)
                }
            })
          })
        },
        __getHVAmministrazione: function (modelHana, modelPosFin, aDomAmministrazione) {
            const that = this
            let filtersAmm = [new Filter("Fikrs", FilterOperator.EQ, "S001"),
							new Filter("Fase", FilterOperator.EQ, "NV"),
							new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
							// new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
                            new Filter("Datbis", FilterOperator.GE, new Date()),
                            new Filter("Prctr", FilterOperator.NE, "S000")
							]
            if(aDomAmministrazione.results.length > 0)
                filtersAmm.push(this.__getFiltersOR(aDomAmministrazione.results, "Prctr"))

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

			return new Promise((resolve, reject) => {
				modelHana.read("/TipAmministrazioneSet",{
					filters: filtersAmm,
					success: function (oData)  {
						//debugger
                        if(modelPosFin.getProperty("/infoSottoStrumento/Reale") == "S"){
                            const fnPredicato = function(it) {return it.Prctr === this.Prctr && it.Reale === 'S0001'}
                            oData.results = that._getSimulatoRealeAmmin(oData.results, fnPredicato)//"it.Prctr === element.Prctr"
                        }
						modelPosFin.setProperty("/formPosFin/amministrazioni", oData.results)
						resolve()
					},
					error:  (err) => {
						//debugger
						resolve(err)
					}
				})
			})
		},
        sorterHVDomSStr: function (a, b) {
			return Number(a) - Number(b)
		},
        sorterAscending: function (a, b) {
            return Number(a) - Number(b)
        },
        sorterAmmByNumericCode: function (a,b) {
			const subStrAmm1 = Number(a.substring(1, a.length))
			const subStrAmm2 = Number(b.substring(1, a.length))
			return subStrAmm1 - subStrAmm2;
		},
        sorterHVString: function (a, b) {
			return a.localeCompare(b)
		},
        openMessageBox: function(sType, sTitle, sMessage, onYesAction, onNoAction){                
            let that = this;
            
            if(!this._oDialog){
                let bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                let oSettings = {
                    type: sap.m.DialogType.Message,
                    styleClass: bCompact ? "sapUiSizeCompact" : "",
                };
            
                this._oDialog = new sap.m.Dialog(oSettings);
                this.getView().addDependent(this._oDialog);
            }                
            
            this._oDialog.destroyContent();
            this._oDialog.destroyButtons();
            
            this._oDialog.setState(sap.ui.core.ValueState[sType]);
            this._oDialog.setTitle(sTitle);
            this._oDialog.addContent( 
                new sap.m.Text({
                    text: sMessage
                }) 
            );
            
            that._oDialog.addButton(					
                new sap.m.Button({
                    text:"{i18n>Ok}",
                    type: sap.m.ButtonType.Emphasized,
                    press: (oEvent) => {
                        if(onYesAction)
                            onYesAction(oEvent);
                        that._oDialog.close();
                    },
                })
            );
            if(["Warning"].includes(sType)){
                that._oDialog.addButton(
                    new sap.m.Button({
                        text:"{i18n>Annulla}",
                        type: sap.m.ButtonType.Emphasized,
                        press: (oEvent) => {
                            if(onNoAction) 
                                onNoAction(oEvent);
                            that._oDialog.close();
                        }
                    })
                );
            }
            
            that._oDialog.open();    
        },
        onSearchDescr: function (oEvent) {
			let {_, value} = oEvent.getSource().getCustomData()[0].mProperties
			let  sCodice = oEvent.getSource().getCustomData()[1].getValue()
			oEvent.getSource().getParent().getParent()
					.getBinding("items").filter(new Filter({
									filters: [new Filter(value, FilterOperator.Contains, oEvent.getParameter("query")),
											  new Filter(sCodice, FilterOperator.Contains, oEvent.getParameter("query"))],
									and: false,
			 						 }))															   
		},
        getAmmDescEstesa: function (Prctr) {
			let modelPosFin = this.getOwnerComponent().getModel("modelPosFin")
			let aAmministrazioni = modelPosFin.getProperty("/formPosFin/amministrazioni")
			return aAmministrazioni.filter(amm => amm.Prctr === Prctr)[0].DescEstesa
		},
        __setFiltersHVPosFin: function (oFormPosf, pgMinore) {
			let modelPosFin = this.getOwnerComponent().getModel("modelPosFin")
			let aFilters = [new Filter("Fikrs", FilterOperator.EQ, "S001"),
							new Filter("Fase", FilterOperator.EQ, "NV"),
							new Filter("Anno", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/AnnoSstr")),
							new Filter("Reale", FilterOperator.EQ, modelPosFin.getProperty("/infoSottoStrumento/Reale")),
							new Filter("Eos", FilterOperator.EQ, "S"),
                            new Filter({
								filters:[new Filter("Versione", FilterOperator.EQ, "P"),
										new Filter("Versione", FilterOperator.EQ, "D")
										],
								and: false
							})
							]
			if(oFormPosf.Prctr)
				aFilters.push(new Filter("Prctr", FilterOperator.EQ, oFormPosf.Prctr))
			if(oFormPosf.Cdr)
				aFilters.push(new Filter("Cdr", FilterOperator.EQ, oFormPosf.Cdr))
			if(oFormPosf.Ragioneria)
				aFilters.push(new Filter("Ragioneria", FilterOperator.EQ, oFormPosf.Ragioneria))
			if(oFormPosf.Missione)
				aFilters.push(new Filter("Missione", FilterOperator.EQ, oFormPosf.Missione))
			if(oFormPosf.Programma)
				aFilters.push(new Filter("Programma", FilterOperator.EQ, oFormPosf.Programma))
			if(oFormPosf.Azione)
				aFilters.push(new Filter("Azione", FilterOperator.EQ, oFormPosf.Azione))
			if(oFormPosf.Capitolo)
				aFilters.push(new Filter("Capitolo", FilterOperator.EQ, oFormPosf.Capitolo))                    
            if(oFormPosf.Pg){
                if(pgMinore){
                    if(parseInt(oFormPosf.Pg) <= 80){
                        aFilters.push(new Filter("Pg", FilterOperator.EQ, oFormPosf.Pg))
                    }
                }else{                    
                    aFilters.push(new Filter("Pg", FilterOperator.EQ, oFormPosf.Pg))
                }
            }           
			if(oFormPosf.Titolo)
				aFilters.push(new Filter("Titolo", FilterOperator.EQ, oFormPosf.Titolo))
			if(oFormPosf.Categoria)
				aFilters.push(new Filter("Categoria", FilterOperator.EQ, oFormPosf.Categoria))
			if(oFormPosf.Ce2)
				aFilters.push(new Filter("Ce2", FilterOperator.EQ, oFormPosf.Ce2))
			if(oFormPosf.Ce3)
				aFilters.push(new Filter("Ce3", FilterOperator.EQ, oFormPosf.Ce3))
			if(oFormPosf.fipex)
				//aFilters.push(new Filter("Fipex", FilterOperator.EQ, oFormPosf.fipex))
				aFilters.push(new Filter("CodificaRepPf", FilterOperator.EQ, oFormPosf.fipex))
			return aFilters
		},
        __setFiltersCheckAuthVsPf: function(aFilters){
            
			let matrixFilterAuth = {
			"CodificaRepPf" : "CODIFICA_REP_PF", 
			"Anno" : "POSFINANNO",
			"Fase" : "POSFINFASE",
			"Prctr" : "CODICE_AMMIN",
			"Cdr" : "CDR",
			"Ragioneria" : "RAGIONERIA",
			"Missione" : "MISSIONE",
			"Programma" : "PROGRAMMA",
			"Azione" : "AZIONE",
			"Capitolo" : "CAPITOLO",
			"Pg" : "PG",
			"Titolo" : "TITOLO",
			"Categoria" : "CATEGORIA",
			"Ce2" : "CLAECO2",
			"Ce3" : "CLAECO3",
			};

            var aFilter = []

            Object.keys(matrixFilterAuth).forEach(property => {
                let filter = aFilters.find((el) => el.sPath === property) 
                let value = !filter ? "" : filter.oValue1
                //matrixFilterAuth[property] = value
                if (value !== "") aFilter.push(new Filter(matrixFilterAuth[property], FilterOperator.EQ, filter.oValue1))
            });

            ///sap/opu/odata/sap/ZSS4_COBI_ALV_SRV/ZKCOBI_POSFIN_FL(P_Anno='2025',P_Fase='NV',P_CodificaRepPf='S030100305.320202.010201',P_Amministrazione='',P_CDR='',P_Ragioneria='',P_Missione='',P_Programma='',P_Azione='',P_Capitolo='',P_PG='',P_Titolo='',P_Categoria='',P_CE2='',P_CE3='')/Set?sap-client=100
            
            return aFilter
			/* let path = `/ZET_POSFIN_AUT_FL(P_Anno='${matrixFilterAuth.Anno}',P_Fase='${matrixFilterAuth.Fase}',P_CodificaRepPf='${matrixFilterAuth.CodificaRepPf}',P_Amministrazione='${matrixFilterAuth.Prctr}',P_CDR='${matrixFilterAuth.Cdr}',P_Ragioneria='${matrixFilterAuth.Ragioneria}',P_Missione='${matrixFilterAuth.Missione}',P_Programma='${matrixFilterAuth.Programma}',P_Azione='${matrixFilterAuth.Azione}',P_Capitolo='${matrixFilterAuth.Capitolo}',P_PG='${matrixFilterAuth.Pg}',P_Titolo='${matrixFilterAuth.Titolo}',P_Categoria='${matrixFilterAuth.Categoria}',P_CE2='${matrixFilterAuth.Ce2}',P_CE3='${matrixFilterAuth.Ce3}')/Set?sap-client=100`

            return path */

        },
        __setDomSStrFilters: function (aFilters) {
			const modelPosFin = this.getOwnerComponent().getModel("modelPosFin")
			if(modelPosFin.getProperty("/infoSottoStrumento/DomAmministrazione/results").length > 0) 
				aFilters.push(this.__setMultiFiltersMissione(modelPosFin.getProperty("/infoSottoStrumento/DomAmministrazione/results"), ["Prctr"]))
			
			if(modelPosFin.getProperty("/infoSottoStrumento/DomTitolo/results").length > 0)
				aFilters.push(this.__setMultiFiltersMissione(modelPosFin.getProperty("/infoSottoStrumento/DomTitolo/results"), ["Titolo", "Categoria", "Ce2", "Ce3"]))

			if(modelPosFin.getProperty("/infoSottoStrumento/DomMissione/results").length > 0) 
				aFilters.push(this.__setMultiFiltersMissione(modelPosFin.getProperty("/infoSottoStrumento/DomMissione/results"), ["Missione", "Programma", "Azione", "Prctr"]))
			
			return aFilters
		},
        onSearchAuth: function(oEvent) {
            var sValue = oEvent.getParameter("value");
            var oFilter = new Filter("ZzdescrEstesaFm", FilterOperator.Contains, sValue);
            var oBinding = oEvent.getParameter("itemsBinding");
            oBinding.filter([oFilter]);
        },
        __getAttributiDescrPosFin: function (oPosFin, modelHana) {
             return Promise.all([
                this._getEntitySet("/TipAmministrazioneSet", [  new Filter("Fase", FilterOperator.EQ, oPosFin.Fase),
                                                                new Filter("Fikrs", FilterOperator.EQ, oPosFin.Fikrs),
                                                                new Filter("Anno", FilterOperator.EQ, oPosFin.Anno),
                                                                new Filter("Reale", FilterOperator.EQ, oPosFin.Reale),
                                                                new Filter("Datbis", FilterOperator.GE, new Date()),
                                                                new Filter("Prctr", FilterOperator.EQ ,oPosFin.Prctr)], modelHana),
                this._getEntitySet("/TipCapitoloSet", [ new Filter("Fase", FilterOperator.EQ, oPosFin.Fase),
                                                        new Filter("Fikrs", FilterOperator.EQ, oPosFin.Fikrs),
                                                        new Filter("Anno", FilterOperator.EQ, oPosFin.Anno),
                                                        new Filter("Reale", FilterOperator.EQ, oPosFin.Reale),
                                                        new Filter("Datbis", FilterOperator.GE, new Date()),
                                                        new Filter("Eos", FilterOperator.EQ, oPosFin.Eos),
                                                        new Filter("Prctr", FilterOperator.EQ ,oPosFin.Prctr), 
                                                        new Filter("Capitolo", FilterOperator.EQ, oPosFin.Capitolo),
                                                        new Filter("Pg", FilterOperator.EQ, oPosFin.Pg)], modelHana),
                this._getEntitySet("/TipTitoloSet", [   new Filter("Fase", FilterOperator.EQ, oPosFin.Fase),
                                                        new Filter("Fikrs", FilterOperator.EQ, oPosFin.Fikrs),
                                                        new Filter("Anno", FilterOperator.EQ, oPosFin.Anno),
                                                        new Filter("Reale", FilterOperator.EQ, oPosFin.Reale),
                                                        new Filter("Titolo", FilterOperator.EQ ,oPosFin.Titolo),
                                                        new Filter("Categoria", FilterOperator.EQ ,oPosFin.Categoria),
                                                        new Filter("Ce2", FilterOperator.EQ ,oPosFin.Ce2),
                                                        new Filter("Ce3", FilterOperator.EQ ,oPosFin.Ce3),
                                                    ], modelHana),
                this._getEntitySet("/TipMissioneSet", [ new Filter("Fase", FilterOperator.EQ, oPosFin.Fase),
                                                        new Filter("Fikrs", FilterOperator.EQ, oPosFin.Fikrs),
                                                        new Filter("Anno", FilterOperator.EQ, oPosFin.Anno),
                                                        new Filter("Reale", FilterOperator.EQ, oPosFin.Reale),
                                                        new Filter("Missione", FilterOperator.EQ ,oPosFin.Missione), 
                                                        new Filter("Programma", FilterOperator.EQ, oPosFin.Programma),
                                                        new Filter("Azione", FilterOperator.EQ, oPosFin.Azione),
                                                        new Filter("Prctr", FilterOperator.EQ ,oPosFin.Prctr)], modelHana)
            ])
        },
        
        _getEntitySet: function (sPath, filters, modelHana) {
            return new Promise ((resolve, reject) => {
              modelHana.read(sPath, {
                  filters: filters,
                  success: (oData) => {
                      resolve({[sPath] : oData.results[0]})
                  }
              })
            })  
        },
        pipeAsync: (...functions) => input => functions.reduce((chain, func) => chain.then(func), Promise.resolve(input)),
        onSearchPosFinDialog: function (oEvent) {
			let aCDSearch = oEvent.getSource().getCustomData()
            let sQuery = oEvent.getParameter("value")
			oEvent.getSource().getBinding("items").filter(new Filter({
                                                    filters: aCDSearch.map(cd => new Filter(cd.getValue(), FilterOperator.Contains, sQuery)),
                                                    and: false,
			 						            }))													   
		},
        __setBusyHelp: function (model, state) {
			model.setProperty("/busyHelp", state)
		},
        formatZeroes: function (value) {
            if(value)
                return value.replace(/^0+/, "");
            else 
                return ""
        },
        getText: function(label, array) {
			if(array && array.length > 0){
				return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText(label, array);
			}
			return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText(label);
		},
        onUpdateFinished: function (oEvent) {
			if(oEvent.getSource().getItems().length === 1){
        		//oEvent.getSource().getItems()[0].setSelected(true)
                var posFin = oEvent.getSource().getItems()[0].getBindingContext('modelHomePosFin').getObject()
                this.navToDetail(null, posFin)
            }
		},
        __getKeyPromiseResolve: function (sPath, modelHana, oParam = null) {
            return new Promise ((resolve, reject) => {
              modelHana.read(sPath, {
                  urlParameters: oParam,
                  success: (oData) => {
                      resolve(oData)
                  },
                  error:(err) => {
                    resolve(null)
                  }
              })
            })  
          },
          onCheckPercentuali: function (oEvent) {
            const oSource = oEvent.getSource();
            if(isNaN(Number(oEvent.getParameter("value").replace(",", ".")))) {
                oSource.setValue(null)
            }
            
          },
          exportListaPosFinExcel: async function(oEvent){
            let modelPosFin = this.getView().getModel("modelHomePosFin")
            
            //primo sheet Anagrafica
            if(!modelPosFin) {
                console.log("no data")
                return;
            }
            // this.getView().setBusy(true)
            // this.getView().setBusy(false)
            var sheet1,sheet2;
            const workbook = XLSX.utils.book_new();                
            //creo struttura per i quadri
            sheet1 = await this.creaStrutturaFiltri();                           
            sheet2 = await this.creaStrutturaTabella(modelPosFin); 
            
            XLSX.utils.book_append_sheet(workbook, sheet1, "Filtri");
            XLSX.utils.book_append_sheet(workbook, sheet2, "Lista");
            const dataOra = this.getDataForSheet();

            var nameFile =
            `Lista Posizioni Finanziarie Spesa ${dataOra}.xlsx`;
            XLSX.writeFile(workbook, nameFile, { type: 'buffer' });
        },

        creaStrutturaFiltri: async function(modelPosFin){

            //var posizioniFinanziarie = modelPosFin.getProperty("/tablePosFin");  
            var modelPosFin = this.getView().getModel("modelPosFin")
            var modelData = modelPosFin.getData();
            var adatta_filtri = modelPosFin.getProperty("/adatta_filtri")
            var posFin = modelData.posFinHelp.posFin === undefined ? "" : modelData.posFinHelp.posFin.CodificaRepPf;

            var obj = [                
                            { "TITOLO" : "Filtri"},
                            { "Label" : "Esercizio" , "Valore": modelData.esercizio},
                            { "Label" : "Sottostrumento" , "Valore": modelData.Sottostrumento},
                            { "Label" : "Posizione Finanziaria" , "Valore": posFin},
                            { "Label" : "Amministrazione" , "Valore": adatta_filtri.AmministrazioneDesc},
                            { "Label" : "Capitolo" , "Valore": adatta_filtri.CapitoloDesc},
                            { "Label" : "Pg" , "Valore": adatta_filtri.PgDesc},
                            { "Label" : "Cdr" , "Valore": adatta_filtri.CdrDesc},
                            { "Label" : "Ragioneria" , "Valore": adatta_filtri.RagioneriaDesc},
                            { "Label" : "Missione" , "Valore": adatta_filtri.MissioneDesc},
                            { "Label" : "Programma" , "Valore": adatta_filtri.ProgrammaDesc},
                            { "Label" : "Azione" , "Valore": adatta_filtri.AzioneDesc},
                            { "Label" : "Titolo" , "Valore": adatta_filtri.TitoloDesc},
                            { "Label" : "Categoria" , "Valore": adatta_filtri.CategoriaDesc},
                            { "Label" : "C.E.2" , "Valore": adatta_filtri.Ce2Desc},
                            { "Label" : "C.E.3" , "Valore": adatta_filtri.Ce3Desc}
            ]
                                    
            var rows = [];
            var maxLungValue = []
            for (let i = 0; i < obj.length; i++) {
                const element = obj[i];

                var keys = Object.keys(element);
                var row = [];
                for (let z = 0; z < keys.length; z++) {
                    const key = keys[z];     


                    if(!element[key]) element[key] = "";
                    if(key === "Valore") maxLungValue.push(element[key].length);                   
                    
                    var formato = {};
                    switch (key) {
                        case "Label":
                            formato.font = { bold : true}; //sz: 14 , 
                            formato.alignment = { horizontal: 'right' };
                            break;                        
                        case "TITOLO":
                            formato.font = { sz: 14 , bold : true}; // 
                            //formato.alignment = { horizontal: 'right' };
                            break;                        
                        default:
                            break;
                    }
                    //{ font: { name: "Courier", sz: 24 } }
                    var oggetto = { v: element[key], t: "s", s: formato }
                    row.push(oggetto);

                }
                rows.push(row);
            }

            var max = Math.max(...maxLungValue)
            
            const ws = XLSX.utils.aoa_to_sheet(rows);
            const wsCols = [
                { width: '20' }, // A
                { width: max }, // B (max * 2)
                ];
            ws["!cols"] = wsCols;

            /* ws["!merges"] = [
				{s:{r:0,c:0},e:{r:0,c:6}},   
				{s:{r:7,c:3},e:{r:7,c:4}},   
				{s:{r:8,c:3},e:{r:8,c:4}},   
				{s:{r:9,c:3},e:{r:9,c:4}},   
				{s:{r:10,c:3},e:{r:10,c:4}}, 
				{s:{r:11,c:3},e:{r:11,c:4}}, 
			] */

            return ws;
        },


        creaStrutturaTabella: async function(modelPosFin){

            var posizioniFinanziarie = modelPosFin.getProperty("/tablePosFin");  
            
            if(!posizioniFinanziarie) posizioniFinanziarie = [];
            posizioniFinanziarie = posizioniFinanziarie.sort((a, b) => {
                if (a.Ammin !== b.Ammin) {
                    return this.sorterHVDomSStr(a.Ammin,b.Ammin);
                } else if (a.Capitolo !== b.Capitolo) {
                    return this.sorterHVDomSStr(a.Capitolo,b.Capitolo);
                } else {
                    return this.sorterHVDomSStr(a.Pg,b.Pg);
                }
            });
            var obj = [];
            var elLabel = {
                Label_Fipex: this.getText("labelPosFin"),
                Label_Prctr: this.getText("Amministrazione"),
                Label_Capitolo: this.getText("Capitolo"),
                Label_Pg: this.getText("Pg"),
                Label_StatusCapitolo: "Stato Capitolo",
                Label_StatusPg: "Stato Pg",
                Label_DescAmmin: this.getText("descAmm"),
                Label_DescCapitolo: this.getText("descrCapitolo"),
                Label_DescPg: this.getText("descrPg"),
                Label_Missione: this.getText("mission"),
                Label_DescMissione: this.getText("descrMissione"),
                Label_Programma: this.getText("programma"),
                Label_DescProgramma: this.getText("descrProgramma"),
                Label_Azione: this.getText("azione"),
                Label_DescAzione: this.getText("descrAzione"),
                Label_Categoria: this.getText("categoria"),
                Label_DescCategoria: this.getText("descrCategoria"),
                Label_Ce2: this.getText("ce"),
                Label_DescCe2: this.getText("descrCe"),
                Label_Ce3: this.getText("ce3"),
                Label_DescCe3: this.getText("descrCe3")
            }  
            obj.push(elLabel);
            //lo uso come matrice per essere trasportabile sulle nostre applicazioni
            posizioniFinanziarie.forEach(element => {
                var el = {
                    Fipex: element.CodificaRepPf,
                    Prctr: element.Prctr,
                    Capitolo: element.Capitolo,
                    Pg: element.Pg,
                    StatusCapitolo: formatter.StatoCapitoloPgTablePosFin(element.StatusCapitolo),
                    StatusPg: formatter.StatoCapitoloPgTablePosFin(element.StatusPg),
                    DescAmmin: element.DescAmmin,
                    DescCapitolo: element.DescCapitolo,
                    DescPg: element.DescPg,
                    Missione: element.Missione,
                    DescMissione: element.DescMissione,
                    Programma: element.Programma,
                    DescProgramma: element.DescProgramma,
                    Azione: element.Azione,
                    DescAzione: element.DescAzione,
                    Categoria: element.Categoria,
                    DescCategoria: element.DescCategoria,
                    Ce2: element.Ce2,
                    DescCe2: element.DescCe2,
                    Ce3: element.Ce3,
                    DescCe3: element.DescCe3
                }               
                obj.push(el)
            });
            var rows = [];
            for (let i = 0; i < obj.length; i++) {
                const element = obj[i];

                var keys = Object.keys(element);
                var row = [];
                for (let z = 0; z < keys.length; z++) {
                    const key = keys[z];                  
                    var formato = {};
                    switch (key) {
                        case "TESTATA":
                            formato.font = { sz: 14 };
                            break;                        
                        case "A":  
                            formato.font = { sz: 14, bold : true};                          
                            break;                        
                        case "B":
                            formato.font = {bold : true};
                            formato.alignment = { horizontal: 'right' };
                            break;                        
                        case "I":
                            formato.font = {bold : true};
                            formato.alignment = { horizontal: 'right' };
                            break;                        
                        case "F":
                            formato.font = {bold : true};
                            formato.alignment = { horizontal: 'right' };
                            break;                        
                        case "D":
                            //formato.alignment = { wrapText: true };
                            break;                        
                        default:

                        if(key.search("Label_") !== -1){
                            formato.font = {bold : true};
                          }
                        if(key.search("Desc") !== -1){
                            formato.alignment = { wrapText: true };
                          }

                            break;
                    }
                    //{ font: { name: "Courier", sz: 24 } }
                    var oggetto = { v: element[key], t: "s", s: formato }
                    row.push(oggetto);

                }
                rows.push(row);
            }

            
            const ws = XLSX.utils.aoa_to_sheet(rows);
            
            const wsCols = [
                { width: "24" }, // Fipex      // A
                { width: "20" }, // Prctr      // B
                { width: "8" }, // Capitolo       // J
                { width: "8" }, // Pg      // C
                { width: "12" }, // StatusCapitolo       
                { width: "9" }, // StatusPg      
                { width: "27" }, // DescAmmin      // C
                { width: "27" }, // DescCapitolo      // B
                { width: "27" }, // DescPg      // D
                { width: "8" }, // Missione     // D
                { width: "27" }, // DescMissione      // E
                { width: "8" }, // Programma     // F
                { width: "27" }, // DescProgramma      // G
                { width: "8" }, // Azione     // H
                { width: "27" }, // DescAzione      // I
                { width: "8" }, // Categoria      // E
                { width: "27" }, // DescCategoria      // F
                { width: "8" }, // Ce2      // G
                { width: "27" }, // DescCe2      // H
                { width: "8" }, // Ce3      // I
                { width: "27" } // DescCe3      // J
                ];
            ws["!cols"] = wsCols;

            /* ws["!merges"] = [
				{s:{r:0,c:0},e:{r:0,c:6}},   
				{s:{r:7,c:3},e:{r:7,c:4}},   
				{s:{r:8,c:3},e:{r:8,c:4}},   
				{s:{r:9,c:3},e:{r:9,c:4}},   
				{s:{r:10,c:3},e:{r:10,c:4}}, 
				{s:{r:11,c:3},e:{r:11,c:4}}, 
			] */

            return ws;
        },
        
        //LT lock posizione finanziaria

        getStructurLock: function(sRecord) {
			var sArrForLock = [{
				"KEY_NR": "1",
				"TABNAME": "ZKPOSFIN",
				"FIELDNAME": "FIKRS",
				"FIELDVALUE": sRecord.Fikrs,
			}, {
				"KEY_NR": "1",
				"TABNAME": "ZKPOSFIN",
				"FIELDNAME": "ANNO",
				"FIELDVALUE": sRecord.Anno,
			}, {
				"KEY_NR": "1",
				"TABNAME": "ZKPOSFIN",
				"FIELDNAME": "FASE",
				"FIELDVALUE": sRecord.Fase,
			}, {
				"KEY_NR": "1",
				"TABNAME": "ZKPOSFIN",
				"FIELDNAME": "REALE",
				"FIELDVALUE": sRecord.Reale,

			}, {
				"KEY_NR": "1",
				"TABNAME": "ZKPOSFIN",
				"FIELDNAME": "VERSIONE",
				"FIELDVALUE": sRecord.Versione,

			}, {
				"KEY_NR": "1",
				"TABNAME": "ZKPOSFIN",
				"FIELDNAME": "FIPEX",
				"FIELDVALUE": sRecord.Fipex,
			}, {
				"KEY_NR": "1",
				"TABNAME": "ZKPOSFIN",
				"FIELDNAME": "DATBIS",
				"FIELDVALUE": this.formatterDate(sRecord.Datbis),
			}];
			this.getOwnerComponent().setModel(new JSONModel(sArrForLock), "modelLockRecord");
			return sArrForLock;
		},
		formatterDate: function(bDate) {
            const dt = DateFormat.getDateTimeInstance({ pattern: "dd.MM.yyyy" });
            const dateFormatted = dt.format(bDate); // returns: "01/08/2020"
			return dateFormatted;
		},
        resetLock: async function(sModel) {
            await this.unLockPosFin();
            this.unlock = false
        },
        unLockPosFin: async function(sModel) {
            if (sModel === undefined || sModel === null) {
				var sArrLock = this.getOwnerComponent().getModel("modelLockRecord").getData();
			} else {
				sArrLock = sModel;
			}
			
			if (sArrLock.length > 0) {
				var oCostructorLock = new this.Lock();
				var sCheckReturn = await oCostructorLock.getOperationLock(1, sArrLock);
				this.getOwnerComponent().setModel(new JSONModel([]), "modelLockRecord");
			}
		},
		_setBackNavigation: async function(oEvent) {
			var that = this;
			this.getOwnerComponent().getService("ShellUIService").then(async function(oShellService) {
				oShellService.setBackNavigation(async function() {	
                    //debugger
                    if (sap.ui.core.UIComponent.getRouterFor(that).getHashChanger().hash === "") {
                        that.navToAppLaunchpad("");
                    } else {
                        that.onNavBack();	
                    }		
										
				});
			});

		},

        onNavBack: async function () {		
            //debugger
            await this.unLockPosFin();
			var oHistory = History.getInstance();
			var sPreviousHash = oHistory.getPreviousHash();

			if (sPreviousHash !== undefined) {
				window.history.go(-1);
			} else {
				var oRouter = this.getOwnerComponent().getRouter();
				oRouter.navTo("", {}, true);
			}
					
		},

		/* onExit: function() {
            debugger
			var that = this;
			jQuery.sap.delayedCall(1000, this, function() {
				that.unLockPosFin();
			});
		}, */
		checkLock: async function(sEntityKey) {
			var oCostructorLock = new this.Lock();
			var sRecordLock = this.getStructurLock(sEntityKey);
			var sCheckReturn = await oCostructorLock.getOperationLock(0, sRecordLock);
			if (sCheckReturn.bCheck)
				sCheckReturn = await oCostructorLock.getOperationLock(2, sRecordLock);
			return sCheckReturn;

		},
        _messageBox: function(sText, sType) {
			var sIdButtonError = "buttonError";
			var sIdButtonSuccess = "buttonSuccess";
			var sIdButtonWarning = "buttonWarning";
			switch (sType) {
				case "error":
					MessageBox.error(sText, {
						actions: sap.m.MessageBox.Action.OK,
						emphasizedAction: sap.m.MessageBox.Action.OK,
						id: sIdButtonError
					});
					sap.ui.getCore().byId(sIdButtonError).getButtons()[0].setType("Emphasized");
					break;
				case "success":
					MessageBox.success(sText, {
						actions: sap.m.MessageBox.Action.OK,
						emphasizedAction: sap.m.MessageBox.Action.OK,
						id: sIdButtonSuccess
					});
					sap.ui.getCore().byId(sIdButtonSuccess).getButtons()[0].setType("Emphasized");
					break;
				case "warning":
					MessageBox.warning(sText, {
						actions: sap.m.MessageBox.Action.OK,
						emphasizedAction: sap.m.MessageBox.Action.OK,
						id: sIdButtonWarning
					});
					sap.ui.getCore().byId(sIdButtonWarning).getButtons()[0].setType("Emphasized");
					break;
			}
		},
        navToAppLaunchpad: function(sSemanticOb) {
            var oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");
            var hash = (oCrossAppNavigator && oCrossAppNavigator.hrefForExternal({
                target: {
                    semanticObject: sSemanticOb,
                    action: "display"
                }
            })) || "";
            // l'hash viene usato per navigare alla nuova app
            oCrossAppNavigator.toExternal({
                target: {
                    shellHash: hash
                }
            });

        },
        _getSimulatoRealeAmmin : function (aData, predicato) {
            let aDataSimReale = []
            for (let i = 0; i < aData.length; i++) {
                const element = aData[i];
                if(element.Reale === "R"){
                    //  const fPredicato = new Function('it', predicato)
                    // const fPredicato = predicato.bind(element)
                    if(!aData.find(predicato, element))
                        aDataSimReale.push(element)
                } else if(element.Reale === "S0001")
                            aDataSimReale.push(element)

            }
            return aDataSimReale
        },
        splitTable: function (aData, sSac, sModel, isForExport) {
            const exp = isForExport === true ? "Exp" : ""
			var aDataModel = [], aDataModelRes = []
            //var arrayFigli = ["009","010","012","013","014"]

			for (var i = 0; i < aData.length; i++) {
				if (aData[i].ViewPosition >= "101") { //escludiamo i residui
					aDataModel = aData.splice(0, i)
					aDataModelRes = aData
				}
			} 

            /* aDataModel.forEach(data => {
                if(arrayFigli.indexOf(data.ViewPosition) !== -1){
                    data.FlagGriglia = 'CHILD'
                }
            }); */
			this.getView().setModel(new JSONModel(aDataModel), `${sModel}${exp}`);
			//this.getView().setModel(new JSONModel(aData), sModel);
			if (sSac !== "COMP") {
				this.getView().setModel(new JSONModel(aData), `modelRes${exp}`);
			}
		},
        liveChangeimporti: function(sModel, sProp, section) {
			var that = this;
			// var sValue = oEvent.getParameters().value;
			var regex = /[a-zA-Z]/;
			var sImporto = that.getView().getModel(sModel).getData()[0][sProp];
			// var sImportReturnedAbap = that.getView().getModel(sModField).getData()[sProp];
			if (regex.test(sImporto)) {
				MessageBox.error("Formato Importo Errato");
				that.getView().getModel(sModel).getData()[0][sProp] = "0,00";
			} else {
				var sImportAfterFormatter = that.formatter.formatterOptionFloat(sImporto);
				that.getView().getModel(sModel).getData()[0][sProp] = sImportAfterFormatter;
			}
			that.getView().getModel(sModel).updateBindings(true);
		},
        liveChangeimportiReiscrizioni: function(oEvent,sModel, sProp) {
			var that = this;
			// var sValue = oEvent.getParameters().value;
			var regex = /[a-zA-Z]/;
			var sImporto = oEvent.getSource().getBindingContext(sModel).getObject()[sProp];
			// var sImportReturnedAbap = that.getView().getModel(sModField).getData()[sProp];
			if (regex.test(sImporto)) {
				MessageBox.error("Formato Importo Errato");
				oEvent.getSource().getBindingContext(sModel).getObject()[sProp] = "0,00";
			} else {
				var sImportAfterFormatter = that.formatter.formatterOptionFloat(sImporto);
				oEvent.getSource().getBindingContext(sModel).getObject()[sProp] = sImportAfterFormatter;
			}
			that.getView().getModel(sModel).updateBindings(true);
		},
        liveChangeimportiVert: function(oEvent, sModel, sProp, section) {
			var that = this;

			let path = oEvent.getSource().getBindingContext(sModel).getPath()
			var regex = /[a-zA-Z]/;
            const obj = oEvent.getSource().getBindingContext(sModel).getObject();
			var sImporto = obj[sProp]
			// var sImportReturnedAbap = that.getView().getModel(sModField).getData()[sProp];
			if (regex.test(sImporto)) {
				MessageBox.error("Formato Importo Errato");
				that.getView().getModel(sModel).setProperty(`${path}/${sProp}`,"0,00");
			} else {
				var sImportAfterFormatter = that.formatter.formatterOptionFloat(sImporto);
				//that.getView().getModel(sModel).setProperty(`${path}/${sProp}`) = sImportAfterFormatter;
				that.getView().getModel(sModel).setProperty(`${path}/${sProp}`, sImportAfterFormatter)
			}
			that.getView().getModel(sModel).updateBindings(true);
            this.checkTotRim()
		},
        checkTotRim: function (oEvent) {
			const modelRim = this.getView().getModel("modelRimVert")
			const modelRimData = modelRim.getData()
			//LT effettuo la somma dei riceventi

			let sommaCed = 0
			let sommaRic = 0

			modelRimData.Cedente.forEach(el => {
				sommaCed = sommaCed + parseFloat(el.ValCedente.replaceAll(".",""))
			});

			modelRimData.Riceventi.forEach(el => {
				sommaRic = sommaRic + parseFloat(el.ValRicevente.replaceAll(".",""))
			});
			const somma = sommaCed + sommaRic
			modelRim.setProperty("/DiffFormatted",  this.formatter.formatterOptionFloat(somma))
			modelRim.setProperty("/DiffNumber", somma)		
			modelRim.setProperty("/CheckDiff", parseFloat(somma) === 0 ? true : false )		

		},
        formatterImporti: function (aData, sPar,sString) {
			if(sPar){
				for (var i = 0; i < aData.length; i++) {

					for (var j = 1; j < 100; j++) {

						if (j < 10) {
							var sTexCP = "ImportoCPAnno00";
							var sTexCS = "ImportoCSAnno00";
						} else if (j > 10 && j < 100) {
							var sTexCP = "ImportoCPAnno0";
							var sTexCS = "ImportoCSAnno0";
						} else {
							var sTexCP = "ImportoCPAnno";
							var sTexCS = "ImportoCSAnno";
						}

						aData[i][sTexCP + j] = this.formatter.valueForAps(aData[i][sTexCP + j])
						aData[i][sTexCS + j] = this.formatter.valueForAps(aData[i][sTexCS + j])
					}

				}
			} else {
				for (var i = 0; i < aData.length; i++) {

					aData[i][sString] = this.formatter.valueForAps(	aData[i][sString])

				}
			}
		},
        getUserInfo: function(sParameter) {
			return this.getOwnerComponent().getModel("userInfo").getProperty("/" + sParameter)
		},
        liveChangeAnnoPluri: function(oEvent, sModel, sCase) {
			var sValue = oEvent.getParameters().value;
			var that = this;
			var oNum = parseInt(sValue);
			//var sModelFragmAna = that._oDialogPlur.getModel(sModel);
			var sModelFragmAna = that.getView().getModel(sModel);
			if (sCase !== "4") {
				var sPath = oEvent.getSource().getBindingContext("modelPluri").getPath();
				var sModelFragItems = oEvent.getSource().getBindingContext("modelPluri").getObject();
				switch (sCase) {
					case "1":
						sModelFragItems.annoDal = sValue;
						break;
					case "2":
						sModelFragItems.annoAl = sValue;
						break;
					case "3":
						sModelFragItems.ricorrenza = sValue;
						break;
				}
			} else {
				var sModelFragItems = sModelFragmAna.getData();
				sModelFragItems.annoSing = sValue;
			}
			sModelFragmAna.updateBindings(true);
		},

        onPressPluriennali: function(oEvent, visImport) {
			// this._openBusyDialog("");
			this._oDialogPlur = sap.ui.xmlfragment(
				"zsap.com.r3.cobi.s4.gestposfinnv.view.pluriennale",
				this);
			var oObject = {
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
			};

			if(this.getView().getModel("modelPluri")){
					if(!this.getView().getModel("modelPluri").getProperty("/NAV_PLUR")) this.getView().setModel(new JSONModel(oObject),"modelPluri")
			}

            this.getView().getModel("modelPluri").setProperty("/visImporti", visImport)
			
			//this._oDialogPlur.setModel(new JSONModel(oObject), "modelPluri");
			this.getView().addDependent(this._oDialogPlur);
			this._oDialogPlur.open();
			// this.closeBusyDialog();
		},
        onPressRemove: function(oEvent) {
			//var sModel = this._oDialogPlur.getModel("modelPluri");
			var sModel = this.getView().getModel("modelPluri");
			sModel.getData().NAV_PLUR.splice(oEvent.getSource().getBindingContext("modelPluri").getPath().split(
				"NAV_PLUR/")[1], 1);
			sModel.updateBindings(true);
		},

		onPressAdd: function() {
			//var sModel = this._oDialogPlur.getModel("modelPluri");
			var sModel = this.getView().getModel("modelPluri");
            //lt! mi recupero tutto il necessario:
			sModel.getData().NAV_PLUR.push({
				annoDal: "",
				annoAl: "",
				ricorrenza: "1",
				importo: "0,00"
			});
			sModel.updateBindings(true);
		},
        onClosePluriennale: function($event, annulla) {
        var check = true
        if(annulla){
            this.deleteRowsIncomplete()
        }else{
            check = this.initCheckImporti()
        }
        if(check){
            this._oDialogPlur.close();
            this._oDialogPlur.destroy();
        }
			
		},
        deleteRowsIncomplete: function(){
            var sModel = this.getView().getModel("modelPluri");
            const controllaImporti = sModel.getProperty("/visImporti")
            if(sModel && sModel.getData().NAV_PLUR){
                var rows = sModel.getData().NAV_PLUR
                let newRows = []
                for (let i = 0; rows && i < rows.length; i++) {
                    const row = rows[i];
                    if(row.annoAl.length === 4 
                        && row.annoAl.length === 4 
                        && parseInt(row.ricorrenza) > 0
                        && row.importo !== "0,00"){
                            newRows.push(row)
                        }                
                    }
                    sModel.setProperty("/NAV_PLUR", newRows)
            }
        },
        initCheckImporti: function(){
            var check = true;
            var sModel = this.getView().getModel("modelPluri");
            const controllaImporti = sModel.getProperty("/visImporti")
            var nav = sModel.getData().NAV_PLUR
            if(nav.length > 0){
                check = this.checkPluri(nav,controllaImporti)
            }
            return check
        },
        checkPluri:function(rows,controllaImporti){
            const esercizio = parseInt(this.getView().getModel("globalModel").getProperty("/ANNO"))
            const min = Math.min(...rows.map(item => item.annoDal));
            
            var errori = []            
            var annoMin = (esercizio - 1)
            if(!controllaImporti) annoMin = esercizio
            //lt controllo anno minimo            
            if(min <= annoMin){
                errori.push(`Errore in un anno iniziale:\n`)
                errori.push(`I'anno iniziale di un pluriennio non può essere inferiore o uguale all'anno ${esercizio -1}\n`)
                errori.push(`\n`)
            }


            var ricorrenze = []
            rows.forEach(row => {
                if(!row.ricorrenza || parseInt(row.ricorrenza) === 0  ){
                    ricorrenze.push(`Ricorrenza errata nella riga Anno Dal ${row.annoDal} Anno Al ${row.annoAl}\n`)
                }
            });
            if(ricorrenze.length > 0) {
                ricorrenze.unshift(`Errori nelle ricorrenze:\n`)
                ricorrenze.push(`\n`)
            }

            var importi = []
            if(controllaImporti){

                rows.forEach(row => {
                    if(!row.importo || parseInt(row.importo) === 0  ){
                        importi.push(`Importo non valido nella riga Anno Dal ${row.annoDal} Anno Al ${row.annoAl}\n`)
                    }
                });
                if(importi.length > 0) {
                    importi.unshift(`Errori negli importi:\n`) 
                    importi.push(`\n`)
                }
            }
                
            var yearInverted = []
            var noYearInsert = false
            rows.forEach(row => {
                if(row.annoAl.length !== 4 || row.annoDal.length !== 4  ){
                    yearInverted.push(`Inserimento errato degli anni nella riga Anno Dal ${row.annoDal} Anno Al ${row.annoAl}\n`)
                    if(row.annoAl.length === 0 || row.annoDal.length === 0){
                        noYearInsert = true                       
                    }
                }else if(row.annoAl.length === 4 && row.annoDal.length === 4 ){ 
                    if(parseInt(row.annoAl) < parseInt(row.annoDal)){
                        yearInverted.push(`Anno Dal ${row.annoDal} non può essere maggiore di Anno al ${row.annoAl}\n`)
                    }
                    if(parseInt(row.annoAl) >= (parseInt(esercizio) + 100) || parseInt(row.annoDal) >= (parseInt(esercizio) + 100) ){
                        yearInverted.push(`Anno Dal ${row.annoDal} e anno Al ${row.annoAl} non possono essere maggiorni di ${(parseInt(esercizio) + 100)}\n`)
                    }

                }
            });

            if(yearInverted.length > 0){
                if(noYearInsert)  {
                    yearInverted = [`Mancato inserimento degli anni in uno o più plurienni\n`]
                    errori = []
                }
                yearInverted.unshift(`Errori nei periodi:\n`)
                yearInverted.push(`\n`)
            }
                
            
            //LT - Controlla se tutti gli elementi di arr sono contenuti in target
            let checker = (arr, target) => arr.every(v => target.includes(v));
            let arrayRowErrore = []
            
            for (let i = 0; i < rows.length; i++) {
                let err = [];
                for (let j = i; j < rows.length; j++) {
                    if (parseInt(rows[j].annoDal) <= parseInt(rows[i].annoDal)
                    && parseInt(rows[j].annoAl ) >= parseInt(rows[i].annoDal)
                    && i != j) {
                        if (!err.includes(rows[i])) err.push(rows[i]);
                        if (!err.includes(rows[j])) err.push(rows[j]);
                    }
                    if (parseInt(rows[i].annoDal) <= parseInt(rows[j].annoDal)
                    && parseInt(rows[i].annoAl ) >= parseInt(rows[j].annoDal)
                    && i != j) {
                        if (!err.includes(rows[i])) err.push(rows[i]);
                        if (!err.includes(rows[j])) err.push(rows[j]);
                    }
                }
                let alreadyPicked = false;
                arrayRowErrore.forEach(rowErrore => {
                    if (checker(err, rowErrore)) alreadyPicked = true;
                });
                if (err.length > 0 && !alreadyPicked) arrayRowErrore.push(err);
            }
            
            if(arrayRowErrore.length !== 0){
                errori.push("Attenzione, ci sono degli intervalli pluriennali in sovrapposizione:\n");
                arrayRowErrore.forEach(rowErrore => {
                    let errore = "";
                    rowErrore.forEach(err => {
                        errore += " - " + err.annoDal + " --> " + err.annoAl + "\n";
                    });
                    errori.push(errore);
                });
            }                
            
            const arrayCompleto = [...yearInverted,...ricorrenze,...importi,...errori]
            //if(yearInverted.length > 0 && ricorrenze.length === 0  && importi.length === 0 && errori.length === 0){
            //metto 4 perchè ho gli a capo
            if(arrayCompleto.length > 0){
                let listaErrori = ""
                arrayCompleto.forEach(el => {listaErrori = listaErrori + el})
                MessageBox.error(listaErrori)
                return false
            }
            return true
        },
        exposeMsgErrCustom: function(err, msgSafe){
            if(err&& parseInt(err.statusCode) === 404 && err.responseText){
                const message = JSON.parse(err.responseText)
                if(message && message.error && message.error.message){
                    MessageBox.error(message.error.message.value)
                    return
                }
                MessageBox.error(msgSafe)
            } else{
                MessageBox.error(msgSafe)
            }
        },
        onExportQC:function(){
			
			var aCopia = JSON.parse(JSON.stringify(this.getView().getModel("modelTableQuadro").getData()));
			this.getView().setModel(new JSONModel(aCopia), "modelTableQuadroCopia");
			var sValue = this.getView().getModel("modelTitle").getProperty("/Title");
			var sNameFile =sValue+this.getDataForSheet();
			this.downloadExcel(sNameFile,"modelTableQuadroCopia", this.getOwnerComponent().getModel("globalModel").getData().ANNO,true)
		},
        getDataForSheet:function(){
			let oDateTimeFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
                pattern: "dd.MM.YYYY_HH_mm"
            });
            
            let sNow = oDateTimeFormat.format(new Date());
            
            return sNow;
		},
        //Export
		downloadExcel: function(nameFile, nameModel,sAnno,bTrienno) {
			var that = this;
			//creao l'array per l'excel
			var arrExcel = this.getView().getModel(nameModel).getData();
			var oSettings = {
				workbook: {
					columns: this._getColsForExcel(sAnno,bTrienno),
					context: {
						sheetName: "Contabile"
					}
				},
				dataSource: arrExcel,
				worker: true,
				fileName: nameFile
			};
			new Spreadsheet(oSettings).build();

		}, // OK
		_getColsForExcel: function (sAnno, bTrienno) {
			var aCols = [];

			var oModelCopia = this.getView().getModel("modelTableQuadroCopia").getData();

			if (bTrienno) {
				var iNum = 3;
			} else {
				var iNum = 100;
			}


			oModelCopia.forEach(function (single) {
				if (single.ImportoCPAnno001) {
					single.ImportoCPAnno001 = parseFloat((single.ImportoCPAnno001.replaceAll(".", "")).replaceAll(",", "."))
					single.ImportoCPAnno002 = parseFloat((single.ImportoCPAnno002.replaceAll(".", "")).replaceAll(",", "."))
					single.ImportoCPAnno003 = parseFloat((single.ImportoCPAnno003.replaceAll(".", "")).replaceAll(",", "."))

					single.ImportoCSAnno001 = parseFloat((single.ImportoCSAnno001.replaceAll(".", "")).replaceAll(",", "."))
					single.ImportoCSAnno002 = parseFloat((single.ImportoCSAnno002.replaceAll(".", "")).replaceAll(",", "."))
					single.ImportoCSAnno003 = parseFloat((single.ImportoCSAnno003.replaceAll(".", "")).replaceAll(",", "."))
				}



			});

			aCols.push(this._addColsExcelBase(" ", ["ViewLabel"], 'string'));
			for (var i = 0; i < iNum; i++) {
				aCols.push(this._addColsExcelBase("Competenza Anno " + (parseInt(sAnno) + i), [("ImportoCPAnno00" + (i + 1))], 'number'));
			}
			for (var i = 0; i < iNum; i++) {
				aCols.push(this._addColsExcelBase("Cassa Anno " + (parseInt(sAnno) + i), [("ImportoCSAnno00" + (i + 1))], 'number'));
			}



			return aCols;
		}, // OK
        _addColsExcelBase: function (nameLabel, field, type, sPar) {
			if (type !== "string") {
				return {
					label: this.recuperaTestoI18n(nameLabel, sPar),
					property: field,
					type: type,
					scale:2,
					delimiter: true,
				};
			} else {
				return {
					label: this.recuperaTestoI18n(nameLabel, sPar),
					property: field,
					type: type,
					width:"25rem"
				};
			}
		}, // OK

        recuperaTestoI18n: function(testoDaRecuperare) {
			return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText(testoDaRecuperare);
		},

        exportExcelQuadro: async function (title, from){
            let modelPos = this.getView().getModel("modelPosFin");
            var modelPosFin;
            if (modelPos) {
                modelPosFin = modelPos.getData();
            }
            if (!modelPosFin) {
                console.log("no data")
                return;
            }
            this.getView().setBusy(true);
            var sheet1;
            const workbook = XLSX.utils.book_new();
            this.getView().setModel(new JSONModel(), 'exportModel');
                sheet1 = await this.creaStrutturaQuadro(title,from);
            
            if (sheet1) XLSX.utils.book_append_sheet(workbook, sheet1, "Quadro Contabile");

            this.getView().setBusy(false);
            XLSX.writeFile(workbook, `${title} DLB ${this.getDataForSheet()}.xlsx`, { type: 'buffer' });
            this.closeBusyDialog()
        },

        creaStrutturaQuadro: async function (title, from) {

            let modelPosFin = this.getView().getModel("modelPosFin").getData();
            const esercizio = this.getView().getModel("globalModel").getProperty("/ANNO") 

            
            let modelTile = this.getView().getModel("modelTitle")
            let modelTitleData = modelTile.getData()
            //! lt recupero i dati precedentemente raccolti e genero le tabelle
            // creazione testata 6 anni 3 CP 3 CS
            var anniMovPosFin = []
            var rowAnni = { "0": "","1": "","2": "" };
            var cpcsRow =[];
            let cpcsLabel = ["Competenza","Cassa"]

            let isCompetenza = null
            
            if(modelTitleData.From === 'CBREI' || modelTitleData.From === 'FN'){
                isCompetenza = true
                cpcsLabel = ["Competenza"]
            }

            const wsCols = [];
            
            var exportModel = this.getView().getModel('exportModel');
            

            cpcsLabel.forEach(cpcs => {                
                for (let i = 0; i < 3; i++) {
                    anniMovPosFin.push(parseInt(esercizio) + i)
                }
                
                
                anniMovPosFin.forEach(el => {
                    rowAnni[el + cpcs + "_Testata"] = `${cpcs} ${el.toString()}`
                    cpcsRow[el + cpcs + "_Testata"] = `${cpcs} ${el.toString()}`
                });
                
            });

            const arrayAnni = Object.keys(rowAnni)
            //regolo la larghezza delle colonne
            for (let i = 0; i < 11; i++) {
                wsCols.push({ width: '23' })
            }          

            var obj = [
                { TITOLO: title },
                {}
            ]
            

            exportModel.setProperty("/merge" , [])
            exportModel.setProperty("/count" , 1)
            //if(from === "QC"){
                var rowQuadroPF = this._creaExcelQuadroPF("modelTableQuadro", rowAnni , isCompetenza ,null)   
                obj = [...obj,...rowQuadroPF];
            //}

            var rowTablePluriComp = this._creaExcelDaA("modelTableQuadroDal", "Competenza",  this.recuperaTestoI18n("StanzPluriComp"))            
            obj = [...obj,...rowTablePluriComp];   
            //lt se CB sarà false e quindi non esporterò la cassa
            if(this.getView().getModel("modelTitle").getProperty("/DalAlCs")){
                var rowTableCassa = this._creaExcelDaA("modelTableQuadroDalCs", null, this.recuperaTestoI18n("StanzPluriCassa"))            
                obj = [...obj,...rowTableCassa];            
            }         
            
            obj.forEach(o => {
                delete o.ViewPosition;
            })
            var rows = this._formatRows(obj)           
            const ws = XLSX.utils.aoa_to_sheet(rows);
            //in base alle colonne creo la larghezza

            ws["!cols"] = wsCols;
            //inserisco i merges
            ws["!merges"] = exportModel.getProperty("/merge")

            return ws

        },


        openBusyDialog: function (sText) {
			// instantiate dialog
			// if (!this._dialog) {
			sap.ui.getCore()._dialog = sap.ui.xmlfragment("zsap.com.r3.cobi.s4.gestposfinnv.view.fragment.BusyDialog", this); //zsap.com.r3.cobi.s4.gestposfinnv.view.pluriennale
			if (sText) {
                //this.getView().getModel("exportModel").setProperty("/Load", sText)
				sap.ui.getCore()._dialog.setText(sText);
			}
			this.getView().addDependent(sap.ui.getCore()._dialog);
			// }

			// open dialog
			// jQuery.sap.syncStyleClass("sapUiSizeCompact", this.getView(), this._dialog);
			sap.ui.getCore()._dialog.open();
		},

        changeTextToBusy: function(sText){
            if (sText) {
                //this.getView().getModel("exportModel").setProperty("/Load", sText)
                sap.ui.getCore()._dialog.setText(sText);
			}
        },

		closeBusyDialog: function () {
			try {
				if (sap.ui.getCore()._dialog) {
					sap.ui.getCore()._dialog.close();
					sap.ui.getCore()._dialog.destroy();
				}
			} catch (error) {
				//Popup già chiusa
			}
		},
        /* EXPORT EXCEL ------------------------------------------------------------- */
        exportExcel: async function (tipoPosizione) {
            let modelPos = this.getView().getModel("modelPosFin");
            var modelPosFin;
            if (modelPos) {
                modelPosFin = modelPos.getData();
            }
            if (!modelPosFin) {
                console.log("no data")
                return;
            }
            var sheet1, sheet2, sheet3;
            const workbook = XLSX.utils.book_new();
            this.getView().setModel(new JSONModel(), 'exportModel');
                sheet1 = await this.creatStrutturaAnagrafica(modelPosFin);
                sheet2 = await this.creaStrutturaContabile("Competenza");
                sheet3 = await this.creaStrutturaContabile("Cassa")

            if (sheet1)XLSX.utils.book_append_sheet(workbook, sheet1, "Anagrafica");
            if (sheet2) XLSX.utils.book_append_sheet(workbook, sheet2, "Competenza");
            if (sheet3) XLSX.utils.book_append_sheet(workbook, sheet3, "Cassa");

            XLSX.writeFile(workbook, `Gestione Posizione Finanziaria ${tipoPosizione}.xlsx`, { type: 'buffer' });

            if(tipoPosizione === "Spesa"){
                MessageBox.information("Export terminato")
                this.getView().setBusy(false);
            }
        },
        creatStrutturaAnagrafica: async function (modelPosFin) {

            /* 
            recupera noipa e irap come descrizione dalle select
            */
            const modelHana = this.getOwnerComponent().getModel("sapHanaS2")
            let listNonCuSet = await this.__getDataPromise("/CuIrapNonCuSet", [], modelHana)
            var listNoiPa = modelPosFin.formPosFin.Noipa
            const esercizio = this.getView().getModel("globalModel").getProperty("/ANNO")

            var filterElCuIrap = listNonCuSet.filter(item => item.Indicatore === modelPosFin.detailAnagrafica.CuIrapNoncu)
            var filterElNoiPa = listNoiPa.filter(item => item.CodiceNoipa === modelPosFin.detailAnagrafica.Noipa)
            var elCuIrap;
            var elNoiPa;
            var codiFofpSpe = modelPosFin.detailAnagrafica.FOFP;
            var fofp = "";

            //recupero il tipo fondo
            var tipoFondo = modelPosFin.detailAnagrafica.tipoFondo;

            var selTipoSpesa = modelPosFin.detailAnagrafica.tipoSpesaCapitolo;
            var selNatura = modelPosFin.detailAnagrafica.CodiceNaturaSpesa;

            if (selTipoSpesa) {
                let tipoSpesaCall = await this.__getDataPromise("/TipoSpesaSet", [new Filter("CapitoloPg", FilterOperator.EQ, 'C')], modelHana)
                var tipoSpesaSelected = jQuery.grep(tipoSpesaCall, function (n, i) {
                    return n.CodiceTipoSpesa === selTipoSpesa;
                });
                selTipoSpesa = tipoSpesaSelected[0].DescTipoSpesa;
            }

            if (selNatura) {
                let naturaSpesaCall = await this.__getDataPromise("/NaturaSpesaSet", [], modelHana)
                var selNaturaSelected = jQuery.grep(naturaSpesaCall, function (n, i) {
                    return n.CodiceNaturaSpesa === selNatura;
                });
                selNatura = selNaturaSelected[0].DescNaturaSpesa;
            }


            var tipoFondoList = modelPosFin.formPosFin.tipofondo
            if (tipoFondo) {
                var tipoFondoSelected = jQuery.grep(tipoFondoList, function (n, i) {
                    return n.CodiceTipoFondo === tipoFondo;
                });
                tipoFondo = tipoFondoSelected[0].DescEstesa;
            }
            var areaDestinataria = modelPosFin.detailAnagrafica.AreaDestinataria;

            if (areaDestinataria) {
                switch (areaDestinataria) {
                    case "M":
                        areaDestinataria = "Aree Montane"
                        break;
                    case "D":
                        areaDestinataria = "Aree Depresse"
                        break;
                    default:
                        areaDestinataria = ""
                        break;
                }
            }
            var tipoSpesa = modelPosFin.detailAnagrafica.TipoSpesaPg;

            if (tipoSpesa) {
                switch (tipoSpesa) {
                    case "RIP":
                        tipoSpesa = "Ripartita"
                        break;
                    case "OBB":
                        tipoSpesa = "Obbligatoria"
                        break;
                    case "FIS":
                        tipoSpesa = "Fissa"
                        break;
                    case "ORD":
                        tipoSpesa = "Ordinaria"
                        break;
                    default:
                        tipoSpesa = ""
                        break;
                }
            }

            if (codiFofpSpe === "FP") {
                fofp = "Fondo Progetti ai sensi del D.Lgs 229/2011 articolo 10 comma 2"
            } else if (codiFofpSpe === "FO") {
                fofp = "Fondo Opere ai sensi del D.Lgs 229/2011 articolo 10 comma 2"
            }

            if (filterElCuIrap && filterElCuIrap.length > 0) {
                elCuIrap = filterElCuIrap[0].Desc;
            }
            if (filterElNoiPa && filterElNoiPa.length > 0) {
                elNoiPa = filterElNoiPa[0].DescNoipa;
            }
            var obj =
                [
                    { TESTATA: `Esercizio: ${esercizio}, Posizione Finanziaria N. ${modelPosFin.PosFin.CodificaRepPf} Dettaglio Struttura Amministrativa Centrale ${modelPosFin.strutturaAmminCentrale.Codifica_rep_sar}` },
                    { A: "Anagrafica Posizione Finanziaria" },
                    { A: "", B: "Amministrazione", C: modelPosFin.detailAnagrafica.AMMINISTAZIONE, D: modelPosFin.detailAnagrafica.DESC_AMMINISTAZIONE },
                    {},
                    { A: "", B: "Capitolo", C: modelPosFin.detailAnagrafica.CAPITOLO, D: modelPosFin.detailAnagrafica.StatusCapitolo === true ? "Attivo" : "Disattivo" },
                    { A: "", B: "Pg", C: modelPosFin.detailAnagrafica.pg, D: modelPosFin.detailAnagrafica.StatusPg === true ? "Attivo" : "Disattivo" },
                    //,  F: "Capitolo" , G: modelPosFin.detailAnagrafica.CAPITOLO, H: modelPosFin.detailAnagrafica.StatusCapitolo === true ? "Attivo" : "Disattivo" , I: "Pg" , J: modelPosFin.detailAnagrafica.pg , H: modelPosFin.detailAnagrafica.StatusPg === true ? "Attivo" : "Disattivo"},
                    {},
                    { A: "", B: "Missione", C: modelPosFin.detailAnagrafica.MISSIONE, D: modelPosFin.detailAnagrafica.DESC_MISSIONE },
                    { A: "", B: "Programma", C: modelPosFin.detailAnagrafica.PROGRAMMA, D: modelPosFin.detailAnagrafica.DESC_PROGRAMMA },
                    { A: "", B: "Azione", C: modelPosFin.detailAnagrafica.AZIONE, D: modelPosFin.detailAnagrafica.DESC_AZIONE },
                    {},
                    //E: "", F: "" , G: modelPosFin.detailAnagrafica.UdvL1, H: modelPosFin.detailAnagrafica.UdvL2 
                    { A: "", B: "Udv", C: modelPosFin.detailAnagrafica.UdvL1, D: modelPosFin.detailAnagrafica.UdvL2 },
                    {},
                    { A: "", B: "Tit", C: modelPosFin.detailAnagrafica.TITOLO, D: modelPosFin.detailAnagrafica.DESC_TITOLO, },
                    { A: "", B: "Cat", C: modelPosFin.detailAnagrafica.CATEGORIA, D: modelPosFin.detailAnagrafica.DESC_CATEGORIA, },
                    { A: "", B: "Cdr", C: modelPosFin.detailAnagrafica.CDR, D: modelPosFin.detailAnagrafica.CDR_DESCR, },
                    { A: "", B: "Rag", C: modelPosFin.detailAnagrafica.RAG, D: modelPosFin.detailAnagrafica.DESC_RAG, },
                    {},
                    { A: "", B: "Mac", C: modelPosFin.detailAnagrafica.MAC, D: modelPosFin.detailAnagrafica.DESC_MAC },
                    {},
                    { A: "", B: "Tipo Fondo", C: tipoFondo },
                    { A: "", B: "Tipo Spesa", C: selTipoSpesa },
                    { A: "", B: "Tipo Natura Spesa", C: selNatura },
                    {},
                    { A: "", B: "Memoria", C: modelPosFin.detailAnagrafica.Memoria === true ? "Sì" : "NO" },
                    { A: "", B: "Capitolone", C: modelPosFin.detailAnagrafica.Capitolone === true ? "Sì" : "NO" },
                    {},
                    { A: "", B: "CU/IRAP/NON CU", C: elCuIrap.toUpperCase() },
                    { A: "", B: "NOIPA", C: elNoiPa.toUpperCase() },
                    { A: "", B: "FO/FP", C: fofp },

                ];

            obj = this.addRowPosFinIRAP(obj, modelPosFin);

            var codCap = !modelPosFin.detailAnagrafica.CODICE_STANDARD_CAPITOLO ? "" : modelPosFin.detailAnagrafica.CODICE_STANDARD_CAPITOLO
            var codPg = !modelPosFin.detailAnagrafica.CODICE_STANDARD_PG ? "" : modelPosFin.detailAnagrafica.CODICE_STANDARD_PG
            var obj = [...obj,
            {},
            { A: "Denominazione Capitolo" },
            { A: "", B: "Codice Standard", C: codCap },
            { A: "", B: "Denominazione Integrale", C: modelPosFin.detailAnagrafica.CD_CAPITOLO_DEN_EST },
            { A: "", B: "Denominazione Ridotta", C: modelPosFin.detailAnagrafica.CD_CAPITOLO_DEN_BREVE },
            {},
            { A: "Denominazione PG" },
            { A: "", B: "Codice Standard", C: codPg },
            { A: "", B: "Denominazione Integrale", C: modelPosFin.detailAnagrafica.CD_PG_DEN_EST },
            { A: "", B: "Denominazione Ridotta", C: modelPosFin.detailAnagrafica.CD_PG_DEN_BREVE },
            {},
            { A: "Anagrafica Piano Di Gestione" },
            { A: "", B: "Classif Econ 2° Livello", C: modelPosFin.detailAnagrafica.CE2, D: modelPosFin.detailAnagrafica.DESC_CE2 },
            { A: "", B: "Classif Econ 3° Livello", C: modelPosFin.detailAnagrafica.CE3, D: modelPosFin.detailAnagrafica.DESC_CE3 },
            {},
            { A: "", B: "Tipo Spesa", C: tipoSpesa },
            { A: "", B: "Aree Destinatarie degli interventi", C: areaDestinataria },
            { A: "", B: "Obiettivi Ministeri", C: modelPosFin.detailAnagrafica.ObiettiviMinisteri === true ? "Sì" : "No" },
            { A: "", B: "Ruoli di Spesa Fissa", C: modelPosFin.detailAnagrafica.RuoliSpesaFissa === true ? "Sì" : "No" },
            {},
            ]

            obj = this.addRowElenchi(obj, modelPosFin);
            obj = this.addRowCOFOG(obj, modelPosFin);
            obj = this.addRowCollegamenti(obj, modelPosFin);

            var rows = [];
            var cofovPassato = false
            for (let i = 0; i < obj.length; i++) {
                const element = obj[i];

                var keys = Object.keys(element);
                var row = [];
                for (let z = 0; z < keys.length; z++) {
                    const key = keys[z];
                    var formato = {};
                    switch (key) {
                        case "TESTATA":
                            formato.font = { sz: 14 };
                            break;
                        case "A":
                            formato.font = { sz: 14, bold: true };
                            break;
                        case "B":
                            formato.font = { bold: true };
                            formato.alignment = { horizontal: 'right' };
                            break;
                        case "C":
                            //formato.font = {bold : true};
                            break;
                        case "D":
                            //formato.font = {bold : true};
                            break;
                        case "G":
                            //formato.font = {bold : true};
                            break;
                        case "H":
                            //formato.font = {bold : true};
                            break;
                        case "I":
                            formato.font = { bold: true };
                            formato.alignment = { horizontal: 'right' };
                            break;
                        case "F":
                            formato.font = { bold: true };
                            formato.alignment = { horizontal: 'right' };
                            break;
                        case "D":
                            //formato.alignment = { wrapText: true };
                            break;
                        default:
                            break;
                    }
                    //{ font: { name: "Courier", sz: 24 } }
                    var oggetto = { v: element[key], t: "s", s: formato }
                    row.push(oggetto);
                    //verifico che sia passato cofog
                    if (key === "A" & element[key] === "C.O.F.O.G.") {
                        cofovPassato = true
                        //console.log("Cofog passato")
                        //console.log(i)
                    }

                }
                rows.push(row);
            }


            const ws = XLSX.utils.aoa_to_sheet(rows);
            const wsCols = [
                { width: '30' }, // A
                { width: '20' }, // B
                { width: '10' }, // C
                { width: '28' }, // D
                { width: '22' }, // E
                { width: '30' }, // F
                { width: '18' }, // G
                { width: '10' }, // H
                { width: '21' }, // I
                { width: '18' }  // J
            ];
            ws["!cols"] = wsCols;

            ws["!merges"] = [
                { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, /* A1:D1 */
                { s: { r: 7, c: 3 }, e: { r: 7, c: 5 } }, /* A1:A2 */
                { s: { r: 8, c: 3 }, e: { r: 8, c: 5 } }, /* A1:A2 */
                { s: { r: 9, c: 3 }, e: { r: 9, c: 5 } }, /* A1:A2 */
                { s: { r: 10, c: 3 }, e: { r: 10, c: 5 } }, /* A1:A2 */
                { s: { r: 11, c: 3 }, e: { r: 11, c: 5 } }, /* A1:A2 */
                //{s:{r:11,c:3},e:{r:11,c:5}}, /* A1:A2 */
                { s: { r: 13, c: 3 }, e: { r: 13, c: 5 } }, /* A1:A2 */
                { s: { r: 14, c: 3 }, e: { r: 14, c: 5 } }, /* A1:A2 */
                { s: { r: 15, c: 3 }, e: { r: 15, c: 5 } }, /* A1:A2 */
                { s: { r: 16, c: 3 }, e: { r: 16, c: 5 } }, /* A1:A2 */
            ]

            return ws;
        },
        //lt aggiungo all'oggetto dell'anagrafica gli elenchi
        addRowElenchi: function (obj, data) {
            var elements;
            if (data && data.detailAnagrafica) {
                elements = data.detailAnagrafica.elenchiCapitolo;
            }

            var array = [
                { A: "Elenchi" },
                { A: "", EL1: "Amministrazione", EL2: "Codice", CDESC: "Descrizione" },

                {}]

            for (let i = 0; i < elements.length; i++) {
                const element = elements[i];
                var row = {
                    A: "",
                    EL1: element.PrctrElenco,
                    EL2: element.NumeroElenco,
                    CDESC: element.Desc,

                };
                array.push(row)
            }
            array.push({})

            return [...obj, ...array]

        },
        //lt aggiungo all'oggetto dell'anagrafica i COFOG
        addRowDevoluzione: function (obj, data) {
            var elements;
            if (data && data.detailAnagrafica) {
                elements = data.detailAnagrafica.PosizioneFinanziariaDevoluzione;
            }
            var array = [
                { A: "", A1: "Devoluzione" },
                { A: "", LIV1: "Codice Regione", SPAZIO: "", LIV2: "Descr. Regione", LIV3: "Codice Provincia", CDESCR: "Descr. Provincia" },
            ]

            for (let i = 0; i < elements.length; i++) {
                const element = elements[i];
                var row = {
                    A: "",
                    LIV1: element.CodiceRegione,
                    SPAZIO: "",
                    LIV2: element.DescRegione,
                    LIV3: element.CodiceProvincia !== '000' ? element.CodiceProvincia : '',
                    CDESCR: element.DescProvincia

                };
                array.push(row)
            }
            array.push({})

            return [...obj, ...array]

        },
        //lt aggiungo all'oggetto dell'anagrafica i COFOG
        addRowCOFOG: function (obj, data) {
            var elements;
            if (data && data.detailAnagrafica) {
                elements = data.detailAnagrafica.elencoCOFOG;
            }
            var array = [
                { A: "C.O.F.O.G." },
                { A: "", LIV1: "Liv1", LIV2: "Liv2", LIV3: "Liv3", CDESCR: "Descrizione", PERCENTC: "%" },
            ]

            for (let i = 0; i < elements.length; i++) {
                const element = elements[i];
                var row = {
                    A: "",
                    LIV1: element.CofogL1,
                    LIV2: element.CofogL2,
                    LIV3: element.CofogL3,
                    CDESCR: element.Desc,
                    PERCENTC: element.PercCofog
                };
                array.push(row)
            }
            array.push({})

            return [...obj, ...array]

        },
        addRowPosFinIRAP: function (obj, data) {
            var elements;
            if (data && data.detailAnagrafica) {
                elements = data.detailAnagrafica.PosizioneFinanziariaIrap;
            }
            var array = [
                { A: "Posizione Finanziaria IRAP" },
                { A: "", LISTAIRAP: "Posizione Finanziaria IRAP" },
            ]

            for (let i = 0; i < elements.length; i++) {
                const element = elements[i];
                var row = {
                    A: "",
                    LISTAIRAP: element.CodificaRepPf
                };
                array.push(row)
            }
            array.push({})

            return [...obj, ...array]

        },
        //lt aggiungo all'oggetto dell'anagrafica i Collegamenti
        addRowCollegamenti: function (obj, data) {
            var elements;
            if (data && data.detailAnagrafica) {
                elements = data.detailAnagrafica.collegamenti;
            }
            var array = [
                { A: "Visualizza Collegamenti" },
                { A: "", LIV1: "Esercizio", LIV2: "Posizione Finanziaria" },
            ]

            for (let i = 0; i < elements.length; i++) {
                const element = elements[i];
                var row = {
                    A: "",
                    LIV1: element.AnnoMit,
                    LIV2: element.PosfinMit,

                };
                array.push(row)
            }
            array.push({})

            return [...obj, ...array]
        },
        creaStrutturaContabile: async function (label) {

            let modelPosFin = this.getView().getModel("modelPosFin").getData();
            const esercizio = this.getView().getModel("globalModel").getProperty("/ANNO")
            //! lt recupero i dati precedentemente raccolti e genero le tabelle
            // creazione testata 6 anni 3 CP 3 CS
            var anniMovPosFin = []
            var rowAnni = { "0": "","1": "","2": "" };
            var cpcsRow =[];
            let cpcsLabel = ["Competenza","Cassa"]           
            const wsCols = [];
            
            var exportModel = this.getView().getModel('exportModel');
            

            cpcsLabel.forEach(cpcs => {                
                for (let i = 0; i < 3; i++) {
                    anniMovPosFin.push(parseInt(esercizio) + i)
                }
                
                
                anniMovPosFin.forEach(el => {
                    rowAnni[el + cpcs + "_Testata"] = `${cpcs} ${el.toString()}`
                    cpcsRow[el + cpcs + "_Testata"] = `${cpcs} ${el.toString()}`
                });
                
            });

            const arrayAnni = Object.keys(rowAnni)
            //regolo la larghezza delle colonne
            /* for (let i = 0; i < arrayAnni.length; i++) {
                i === 0 ? wsCols.push({ width: '86' }) : wsCols.push({ width: '23' })
            }  */         
            for (let i = 0; i < 11; i++) {
                wsCols.push({ width: '23' })
            }          

            var obj = [
                { TITOLO: `Quadro Contabile ${label}` },
                {}]

            exportModel.setProperty("/merge" , [])
            exportModel.setProperty("/count" , 1)
            
            const modelExcelQuadroPF = label !== "Cassa" ? "modelTableExp" : "modelTableCassaExp"
            const modelExcelDaA = label !== "Cassa" ? "modelTableCompExp" : "modelTableCassaDAExp"
            let isCompetenza = label !== "Cassa" ? true : null
            
            
            var creaExcelQuadroPF = this._creaExcelQuadroPF(modelExcelQuadroPF, rowAnni , isCompetenza, false)   
            obj = [...obj,...creaExcelQuadroPF]               
            if(label === "Cassa"){
            var creaExcelRes = this._creaExcelQuadroPF("modelResExp", rowAnni , null, true)   
            obj = [...obj,...creaExcelRes]
            }           
            var creaExcelDaA = this._creaExcelDaA(modelExcelDaA, isCompetenza)            
            obj = [...obj,...creaExcelDaA]                   
            
            var rows = this._formatRows(obj)           
            const ws = XLSX.utils.aoa_to_sheet(rows);
            //in base alle colonne creo la larghezza

            ws["!cols"] = wsCols;
            //inserisco i merges
            ws["!merges"] = exportModel.getProperty("/merge")

            return ws

        },

        _creaExcelQuadroPF: function (modello, rowAnni, arrayFromAuth, isResidui) {

            var exportModel = this.getView().getModel('exportModel');
            var merge = exportModel.getProperty("/merge")
            var count = exportModel.getProperty("/count")
            const esercizio = this.getView().getModel("globalModel").getProperty("/ANNO")

            var mtCassaExt = this.getView().getModel(modello)
            var mtCassaData = mtCassaExt.getData()
            /* 
            if(!arrayFromAuth){
                var mtCassaExt = this.getView().getModel(modello)
                mtCassaData = mtCassaExt.getData()
            }else{                
                mtCassaData = arrayFromAuth
            } */
            
            var results = mtCassaData    
            var rowCassa = [];    
            
            var testata = jQuery.extend(true, {}, rowAnni);  //lt clono il row anni           
            //elimino la tesata
            if(arrayFromAuth){
                Object.keys(testata).forEach(propTestata => {
                    if(propTestata.includes("Cassa")){
                        delete testata[propTestata]
                    }
                });
            }
            //! LT se devo prendere i residui cancello anche le 2 colonne della testata 
            if(isResidui){
                Object.keys(testata).forEach(propTestata => {
                    if(!propTestata.includes(esercizio) && propTestata.length > 1 || propTestata.includes("Cassa")){
                        delete testata[propTestata]
                    }
                });
                //modifico la label
                testata[`${esercizio}Competenza_Testata`] = `Residui ${esercizio}`
            }
            rowCassa.push(testata)      
            count++   

            for (let z = 0; z < results.length; z++) {                
                const riga = results[z]
                const label = results[z].ViewLabel;
                var objCp;

                let cssRule = riga.Flaggriglia ? riga.Flaggriglia : riga.FlagGriglia

                switch (cssRule) {
                    case 'BOLD':
                        objCp = { "11": label };
                        break;                
                    case 'ALIGNR_RIGHT':
                        objCp = { "0": "    " + label};
                        break;
                    case 'CHILD':
                        objCp = { "11": "         " + label};
                        break;
                
                    default:
                        objCp = { "0": label };
                        break;
                }
                objCp['22'] = "";               
                objCp['33'] = "";               
                
                let arrCassaComp = arrayFromAuth === null ? ["CP","CS"] : ["CP"]
                //! LT recupero solo i residui
                if(isResidui) arrCassaComp = ["CP"]
                let stringAnno = "Anno00"
                /* lt era per gli integrati di int pos finn
                if(isFromIntegrato){
                    arrCassaComp = ["cp","cs"]  
                    stringAnno = "anno00"
                } */ 
                for (let b = 0; b < arrCassaComp.length; b++) {
                    const tipologia = arrCassaComp[b];
                    //!lt isResidui sta ad indicare il recupero solo di una colonna
                    const lgt = !isResidui ? 3 : 1
                    for (let i = 1; i <= lgt; i++) {
                        const num = i;
                        objCp[`Importo${tipologia}Anno00${i}_Number`] = riga[`Importo${tipologia}${stringAnno}${i}`]
                    }
            }   
                rowCassa.push(objCp)
                count++
                merge.push({s:{r:count,c:0},e:{r:count,c:2}})
            }

            rowCassa.push({})
            rowCassa.push({})
            count = count + 2

            exportModel.setProperty("/merge", merge)
            exportModel.setProperty("/count", count)
            return rowCassa
        },

        _creaExcelDaA: function (modello, arrayFromAuth, name) {
            var exportModel = this.getView().getModel('exportModel');
            //var merge = exportModel.getProperty("/merge")
            var count = exportModel.getProperty("/count")
            
            var mtCassaDAExp = this.getView().getModel(modello)
            var mtCassaDAExpData = mtCassaDAExp.getData()
            /* if(!arrayFromAuth){
                var mtCassaDAExp = this.getView().getModel(modello)
                mtCassaDAExpData = mtCassaDAExp.getData()
            }else{
                mtCassaDAExpData = arrayFromAuth
            } */
            
            var rowTableCassa = [{"0" : !name ? "" : name},{ "0" : "", "YearLow_Testata" : "Anno Da", "YearHigh_Testata" : "Anno A", "Cassa_Testata" : arrayFromAuth === null ? "Cassa" : "Competenza"}]
            count = count + 2
            for (let z = 0; z < mtCassaDAExpData.length; z++) {                
                const riga = mtCassaDAExpData[z]
                
                var objCp = { "0": "" };              
                
                objCp.YearLow = riga.YearLow
                objCp.YearHigh = riga.YearHigh
                objCp.Importo = riga.Importo
                rowTableCassa.push(objCp)
                count++
            }
            rowTableCassa.push({})
            rowTableCassa.push({})
            count = count + 2

            exportModel.setProperty("/count", count)
            return rowTableCassa;
        },
        _formatRows: function (obj){
            var rows = [];
            
            for (let i = 0; i < obj.length; i++) {
                const element = obj[i];

                var keys = Object.keys(element);
                var row = [];
                for (let z = 0; z < keys.length; z++) {
                    const key = keys[z];
                    var el = element[key];
                    var formato = {};
                    var numero = false;

                    switch (key) {
                        case "0":
                            //formato.font = { sz: 14, bold : true};                          
                            break;
                        case "00":  //solo BOLD
                            formato.font = { bold: true };
                            break;
                        case "000":  //BOLD & PAD
                            formato.font = { bold: true };
                            //  formato.alignment = { horizontal: 'right' };                         
                            break;
                        case "0000":
                            //formato.font = { sz: 14, bold : true};  
                            //  formato.alignment = { horizontal: 'right' };                        
                            break;
                        case "TITOLO":
                            formato.font = { sz: 14, bold: true };
                            break;
                        case "LABEL":
                            formato.font = { sz: 14, bold: true };
                            break;
                        case "CASSA":
                            formato.font = { sz: 14, bold: true };
                            break;
                        case "COMPETENZA":
                            formato.font = { sz: 14, bold: true };
                            break;
                        default:

                            if (key.search("Importo") !== -1) {
                                numero = true;
                            } else if (key.search("_Testata") !== 1) {
                                //grassetto gli anni
                                formato.font = { bold: true };
                            }
                            //tutti gli altri casi      

                            break;
                    }
                    //{ font: { name: "Courier", sz: 24 } }
                    var oggetto = { v: element[key], t: "s", s: formato }
                    //se numero imposto come tipo cella numero con il t = a n e il formato seguendo la libreria "standard"
                    if (numero) {
                        if(!oggetto.v) oggetto.v = "0,00"
                        if(oggetto.v !== "0.00" && "0,00") {
                            oggetto.v = oggetto.v.replaceAll(".", "")
                            oggetto.v = oggetto.v.replaceAll(",", ".")     
                            oggetto.v = parseFloat(oggetto.v)                       
                    }else{
                        oggetto.v = 0
                    }
                        oggetto.t = 'n';
                        oggetto.z = '#,##0.00';
                    }
                    row.push(oggetto);
                }
                rows.push(row);
            }

            return rows
        },

        changeToUpper: function(oEvent , model, path){
            var oModel = this.getView().getModel(model)
            var stringa = oEvent.getParameter("value");
            stringa = stringa.toUpperCase()
            oModel.setProperty(path,stringa)

            oModel.updateBindings(true)
            

        },

        resetDialogSearchField: function(oSource){
            let oParentDialog = this.getParentDialogControl(oSource);
            if(!oParentDialog) return;
            let aSearchFields = this.getSearchFields(oParentDialog);
            if(!aSearchFields || aSearchFields.length === 0) return;

            aSearchFields.forEach(o => o.setValue());
            aSearchFields.forEach(o => o.fireSearch({}));
        },

        getSearchFields: function(oParentControl){
            return oParentControl.findAggregatedObjects(true, o => o instanceof sap.m.SearchField);
        },

        getParentDialogControl: function(oControl){
            let oControlRef = oControl;
            while(oControlRef !== null && !(oControlRef instanceof sap.m.Dialog)){
                oControlRef = oControlRef.getParent();
            }
            return oControlRef;
        },

        exposeMsgErrCustom: function(err, msgSafe){
            if(err&& parseInt(err.statusCode) === 404 && err.responseText){
                const message = JSON.parse(err.responseText)
                if(message && message.error && message.error.message){
                    MessageBox.error(message.error.message.value)
                    return
                }
                MessageBox.error(msgSafe)
            } else{
                MessageBox.error(msgSafe)
            }
        },
        nuovaDataFN(data){
            let year = data.substring(0,4)
            var month = parseInt(data.substring(4,6))            
            month = month - 1
            let day = data.substring(6,8)
            return new Date(Date.UTC(year, month.toString(), day,  "00", "00", "00"))
        },
        _setCheckFoglio: async function (oPosFin, modelPosFin) {
            var response = {esito : true, msg : []}
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
                return response
            }
            var stringDateDay = this.formatter.formatterDatePatter(new Date(), 0);
            const modelFoglioNotizie = this.getOwnerComponent().getModel("sapHanaS2FoglioNotizie")
            let filterFoglio = [
                //new Filter("STATO_FN", FilterOperator.EQ, "05"),
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
            var fStato = [
                new Filter("STATO_FN", FilterOperator.EQ, "05"),
                new Filter("STATO_FN", FilterOperator.EQ, "04"),
            ]
            filterFoglio.push(new Filter(f, false));
            filterFoglio.push(new Filter(fStato, false));
            //lt usco l'expand altrimenti mi estra N fogli notizie
            const sExpand = { '$expand' :'NAV_POSFIN/NAV_ELENCHI,NAV_POSFIN/NAV_COFOG,NAV_POSFIN/NAV_REVUFF,NAV_POSFIN/NAV_IRAP'};
            let foglioNotizie = await this.__getDataPromisePerFoglio("/ZES_FN_PF_SET", filterFoglio , modelFoglioNotizie , sExpand)
            //let wfFn = await this.__getDataPromisePerFoglio("/ZES_WF_FNFP_SET", [new Filter("NUMERO_FN", FilterOperator.EQ, recPosFin[0].REALE)] , modelFoglioNotizie , {})

            if(foglioNotizie.length > 0) {
                modelPosFin.setProperty("/modificabile", true)
                return response
            }

            let msg = `La posizione finanziaria è presente all'interno del Foglio notizie N ${recPosFin[0].REALE.slice(1)}.\nLa posizione finanziaria non si potrà più modificare finchè il foglio notizie non verrà approvato.\nNon si potranno effettuare variazioni contabili nè di cassa nè di competenza`
            if(!recPosFin.find(el => el.FIPEX === oPosFin.Fipex)) msg = `All'interno del Foglio notizie N ${recPosFin[0].REALE.slice(1)} è presente una posizione finanziaria con lo stesso capitolo.\nLa posizione finanziaria non si potrà più modificare finchè il foglio notizie non verrà approvato.\nNon si potranno effettuare variazioni contabili nè di cassa nè di competenza`
            modelPosFin.setProperty("/modificabile", false)
            //MessageBox.warning(msg)
            response.esito = false
			response.msg = [msg] 
            return response

    },
        
	});
});