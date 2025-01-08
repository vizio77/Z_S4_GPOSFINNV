    sap.ui.define([
            "sap/ui/core/UIComponent",
            "sap/ui/Device",
            "zsap/com/r3/cobi/s4/gestposfinnv/model/models",
            "z_s4_coniauth/coniauth/controls/GestConi",
            "sap/m/MessageBox",
            "sap/ui/model/json/JSONModel"
        ],
        function (UIComponent, Device, models,GestConi,MessageBox,JSONModel) {
        "use strict";

        return UIComponent.extend("zsap.com.r3.cobi.s4.gestposfinnv.Component", {
            GestConi: GestConi,
            metadata: {
                manifest: "json",
                config: {
                    fullWidth: true
                }
            },

            /**
             * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
             * @public
             * @override
             */
            init: function () {
                // call the base component's init function
                UIComponent.prototype.init.apply(this, arguments);

                // enable routing
                this.getRouter().initialize();
                //set language
                sap.ui.getCore().getConfiguration().setLanguage("IT");
                // set the device model
                this.setModel(models.createDeviceModel(), "device");
                this.setModel(models.createIframeModel(), "iframe");
                this.setModel(new JSONModel([]), "modelLockRecord");
                //this.createInfoUserModel()
                this._getConi();                

            },
            _getConi: async function() {

                var oCostructor = new this.GestConi();
                var sAction = this.getDynamicAction();
                try {
                    var sReturn = await oCostructor.getStructureConi("ZGESTPOSFINSPESA", sAction);
                    this.getModel("userInfo").setData(sReturn) 
                    if (!sReturn.ReturnStatus) {
                        this.navToAppLaunchpad("");
                        this._messageBox(sReturn.Message, "error");
                        
                    }else{
                        //console.log(sReturn)
                        this.setModel(models.createuserRoleModel(sReturn), "userRoleModel");
                          
                    }
                } catch (error) {
                    console.log(error)
                    this._messageBox("Errore Libreria Coni", "error");
                    this.navToAppLaunchpad();
                }

                this.setAppTitle(sReturn);
                
                
            },

            setAppTitle: function (sReturn) {
                if (sReturn["AGR_NAME_COLL"].some(item => item.includes("GEST_TECNICA"))) {
                    var sString = `${this.getModel("i18n").getResourceBundle().getText("appTitle")} Versione del 08.01.2025 11:00` //data dell'ultimo deploy
                        this.getService("ShellUIService").then(
                        function (oService) { oService.setTitle(sString); },
                        function (oError) { console.error("Error while setting the title: " + oError); }
                    );
                }
            },

            getDynamicAction: function() {
                var sUrl = window.location.href;
                if (sUrl.includes("-display")) {
                    return "display";
                } else {
                    return "manage";
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

            /* createInfoUserModel: function() {
                if (!window.location.href.includes("localhost")) {
                    var oUserInfo = new sap.ushell.services.UserInfo();
                    var oUser = oUserInfo.getUser();
                    var sNomeCognome, sId;
                    sNomeCognome = oUser.getFullName().toUpperCase();
                    sId = oUser.getId();
                } else {
                    // sto in sviluppo
                    sNomeCognome = "TEST_GEST";
                    sId = 'TEST_GEST';
                }
                const modello = {
                    "NomeCognome": sNomeCognome,
                    "Id": sId
                }
                this.setModel( new JSONModel(modello), "userInfo")
                return modello
                
            }, */
        });
    }
);