const Alexa = require('ask-sdk-core');

const SON_ACCUEIL = "<audio src='soundbank://soundlibrary/ui/gameshow/amzn_ui_sfx_gameshow_player1_01'/>";
const MESSAGE_ACCUEIL = "Bienvenue ! Que voulez-vous commander ? En ce moment la tendance est ";
const MESSAGE_REPROMPT = 'En quoi puis-je vous aider ?';
const MESSAGE_AIDE = "Vous pouvez commander en disant réalise ma commande habituelle ou en disant nouvelle commande";
const MESSAGE_FERMETURE = "À bientôt !";
const ERREUR_COMMANDE_HABITUELLE = "Aucune commande habituelle n'est enregistrée. Créez une commande. Vous pouvez par exemple manger ";
const ERREUR_ADRESSE_HABITUELLE = "Aucune adresse habituelle n'est enregistrée.";
const SUGGESTIONS = "Vous pouvez commander ";


///////////////////////////////////////////// Les informations de l'utilisateur /////////////////////////////////////////////
const request = require('request');

const url_api = 'https://food-mock-api.herokuapp.com/api/v1';
const user_id = 1;
const topOrder = 3;

const getAddress = async (user_id) => {
    return new Promise((resolve, reject) => {
        const options = {
            uri: url_api + "/users/"+ user_id + "/address",
            json: true
        };
        request(options, (error, response, body) => {
            if (error) { return reject(error); }
            else if (response.body.address == null) { resolve(null); }
            else { resolve(response.body.address.street + " " + response.body.address.city + " " + response.body.address.postalCode); }
        });
    });
}

const getUsualOrder = async (user_id) => {
    return new Promise((resolve, reject) => {
        const options = {
            uri: url_api + "/users/"+ user_id + "/orders/usual",
            json: true
        };
        request(options, (error, response, body) => {
            if (error) { return reject(error); }
            else if (response.statusCode == 200) { resolve(response.body); }
            else { resolve(null); }
        });
    });
}

const sendOrder = async (user_id, quantity, product) => {
    return new Promise((resolve, reject) => {
      const options = {
          uri: url_api + "/users/"+ user_id + "/orders",
          json: {
            "order": {
              "products": [
                {
                  "quantity": quantity,
                  "product": {
                    "name": product
                  }
                }
              ]
            }
          }
      };
      request.post(options, (error, response, body) => {
        if (error) { return reject(error); }
        else { resolve(response.statusCode); }
      })
    });
}

const simulateOrder = async (user_id, quantity, product) => {
    return new Promise((resolve, reject) => {
      const options = {
          uri: url_api + "/users/"+ user_id + "/cart",
          json: {
            "order": {
              "products": [
                {
                  "quantity": quantity,
                  "product": {
                    "name": product
                  }
                }
              ]
            }
          }
      };
      request.post(options, (error, response, body) => {
        if (error) { return reject(error); }
        else { resolve(response); }
      })
    });
}

const getPaiementCard = async (user_id) => {
    return new Promise((resolve, reject) => {
      const options = {
          uri: url_api + "/users/"+ user_id + "/card",
          json: true
      };
      request(options, (error, response, body) => {
        if (error) { return reject(error); }
        else { resolve(response.body); }
      })
    });
}

const topXOrders = async (x) => {
    return new Promise((resolve, reject) => {
      const options = {
          uri: url_api + "/products?top=" + x,
          json: true
      };
      request(options, (error, response, body) => {
        if (error) { return reject(error); }
        else { resolve(response.body); }
      })
    });
}
  
const parseTopXOrders = (tab, listProducts) => {
    if (tab.length == 1) return listProducts + tab.shift().name;
    else {
      let currentProduct = tab.shift()
      return parseTopXOrders(tab, currentProduct.name + ", " + listProducts);
    }
}

///////////////////////////////////////////// LAUNCH /////////////////////////////////////////////
const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {
        let sortieVocale = SON_ACCUEIL + MESSAGE_ACCUEIL + parseTopXOrders(await topXOrders(topOrder), "");
        return handlerInput.responseBuilder
            .speak(sortieVocale)
            .reprompt(MESSAGE_REPROMPT)
            .getResponse();
    }
};

///////////////////////////////////////////// SUGGESTIONS /////////////////////////////////////////////

const SuggestionsIntentHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest'
        && request.intent.name === 'SuggestionsIntent';
    },
    async handle(handlerInput) {
        let sortieVocale = SUGGESTIONS + parseTopXOrders(await topXOrders(topOrder), "");

        return handlerInput.responseBuilder
            .speak(sortieVocale)
            .reprompt(MESSAGE_REPROMPT)
            .getResponse();

        
    }
};


///////////////////////////////////////////// CAS COMMANDE HABITUELLE /////////////////////////////////////////////

// Aucune commande habituelle n'est enregistrée
const ErrorCommandeHabituelleIntentHandler = {
    async canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest'
        && request.intent.name === 'CommandeHabituelleIntent'
        && await getUsualOrder(user_id) == null;
    },
    async handle(handlerInput) {
        let sortieVocale = ERREUR_COMMANDE_HABITUELLE + parseTopXOrders(await topXOrders(topOrder), "");
        return handlerInput.responseBuilder
            .speak(sortieVocale)
            .reprompt(sortieVocale)
            .getResponse();
    },
};

// L'utilisateur a invoqué l'adresse habituelle mais elle n'existe pas
const ErrorAdresseHabituelleCommandeHabituelleIntentHandler = {
    async canHandle(handlerInput) {
      const request = handlerInput.requestEnvelope.request;
      const adresseHabituelle = await getAddress(user_id);

      return request.type === 'IntentRequest'&&
          request.intent.name === 'CommandeHabituelleIntent'
          && await getUsualOrder(user_id) != null
          && adresseHabituelle == null
          && request.intent.slots.adresse.value == "habituelle";
    },
    handle(handlerInput) {
      const currentIntent = handlerInput.requestEnvelope.request.intent;
      currentIntent.slots.adresse.value = undefined; 

      return handlerInput.responseBuilder
        .speak(ERREUR_ADRESSE_HABITUELLE)
        .addDelegateDirective(currentIntent)
        .reprompt(MESSAGE_REPROMPT)
        .getResponse();
    },
};

//Le produit de la commande habituelle n'existe plus
const ErrorProduitCommandeHabituelleIntentHandler = {
    async canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const commandeHabituelle = await getUsualOrder(user_id);
        let cmd = commandeHabituelle.shift();
        const qte = cmd.quantity;
        const pdct = cmd.product.name;
  
        return request.type === 'IntentRequest'
        && request.intent.name === 'CommandeHabituelleIntent'
        && (await simulateOrder(user_id, qte, pdct)).statusCode != 200;
    },
    async handle(handlerInput) {
        const commandeHabituelle = await getUsualOrder(user_id);
        let cmd = commandeHabituelle.shift();
        const pdct = cmd.product.name;

        let sortieVocale = "Le produit " + pdct + " de votre commande habituelle n'existe plus. Créez une commande. Vous pouvez par exemple manger " + parseTopXOrders(await topXOrders(topOrder), "");
        return handlerInput.responseBuilder
            .speak(sortieVocale)
            .reprompt(sortieVocale)
            .getResponse();
    },
};

// Commande habituelle existante, mais on n'a pas donné d'adresse
const InProgressCommandeHabituelleIntentHandler = {
    async canHandle(handlerInput) {
      const request = handlerInput.requestEnvelope.request;
      return request.type === 'IntentRequest'&&
          request.intent.name === 'CommandeHabituelleIntent'
          && request.dialogState !== 'COMPLETED'
          && await getUsualOrder(user_id) != null;
    },
    async handle(handlerInput) {
      const currentIntent = handlerInput.requestEnvelope.request.intent;

      const commandeHabituelle = await getUsualOrder(user_id);
      let cmd = commandeHabituelle.shift();
      const qte = cmd.quantity;
      const pdct = cmd.product.name;
      const infosCmd = await simulateOrder(user_id, qte, pdct);

      currentIntent.slots.commande.value = qte + " " + pdct + " pour un total de " + infosCmd.body.price + " €";
      if (currentIntent.slots.adresse.value == "habituelle") currentIntent.slots.adresse.value = await getAddress(user_id);

      return handlerInput.responseBuilder
        .addDelegateDirective(currentIntent)
        .getResponse();
    },
};

// Commande habituelle existante et adresse OK
const CompletedCommandeHabituelleIntentHandler = {
    async canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest'
        && request.intent.name === 'CommandeHabituelleIntent'
        && await getUsualOrder(user_id) != null;
    },
    async handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;

        let commandeHabituelle = await getUsualOrder(user_id);
        let cmd = commandeHabituelle.shift();
        const infosCmd = await simulateOrder(user_id, cmd.quantity, cmd.product.name);

        let sortieVocale = "";
        if (request.intent.confirmationStatus === 'CONFIRMED') {
            let tempsLivraison = "Votre commande vous sera livrée dans " + infosCmd.body.deliveryETA + " minutes. ";

            let paiement = "Le paiement s'effectuera à la livraison. ";
            if (await getPaiementCard(user_id)) { paiement = "Le paiement a été effectué. " }

            let estValide = await sendOrder(user_id, cmd.quantity, cmd.product.name) == 201;
            if (estValide) sortieVocale = "La commande est validée. " + paiement + tempsLivraison + "Bon appétit !";
            else sortieVocale = "Une erreur s'est produite. " + MESSAGE_REPROMPT;
        }
        if (request.intent.confirmationStatus === 'DENIED') sortieVocale = "La commande est annulée. " + MESSAGE_REPROMPT;

        return handlerInput.responseBuilder
            .speak(sortieVocale)
            .reprompt(MESSAGE_REPROMPT)
            .getResponse();
    },
};


///////////////////////////////////////////// CAS NOUVELLE COMMANDE /////////////////////////////////////////////

// L'utilisateur a invoqué l'adresse habituelle mais elle n'existe pas
const ErrorAdresseHabituelleNouvelleCommandeIntentHandler = {
    async canHandle(handlerInput) {
      const request = handlerInput.requestEnvelope.request;
      const adresseHabituelle = await getAddress(user_id);

      return request.type === 'IntentRequest'&&
          request.intent.name === 'NouvelleCommandeIntent'
          && adresseHabituelle == null
          && request.intent.slots.adresse.value == "habituelle";
    },
    handle(handlerInput) {
      const currentIntent = handlerInput.requestEnvelope.request.intent;
      currentIntent.slots.adresse.value = undefined; 

      return handlerInput.responseBuilder
        .speak(ERREUR_ADRESSE_HABITUELLE)
        .addDelegateDirective(currentIntent)
        .reprompt(MESSAGE_REPROMPT)
        .getResponse();
    },
};

//Le produit de la commande n'existe pas
const ErrorProduitCommandeIntentHandler = {
    async canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const pdct = request.intent.slots.commande.value;

        return request.type === 'IntentRequest'
        && request.intent.name === 'NouvelleCommandeIntent'
        && pdct != undefined
        && (await simulateOrder(user_id, 1, pdct)).statusCode != 200;
    },
    async handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const pdct = request.intent.slots.commande.value;

        let sortieVocale = "Le produit " + pdct + " de votre commande n'existe pas. Créez une autre commande. Vous pouvez par exemple manger " + parseTopXOrders(await topXOrders(topOrder), "");
        return handlerInput.responseBuilder
            .speak(sortieVocale)
            .reprompt(sortieVocale)
            .getResponse();
    },
};

// Il nous manque des informations pour compléter le processus : soit l'adresse, soit la commande soit les 2
const InProgressNouvelleCommandeIntentHandler = {
    canHandle(handlerInput) {
      const request = handlerInput.requestEnvelope.request;
      return request.type === 'IntentRequest'&&
          request.intent.name === 'NouvelleCommandeIntent'
          && request.dialogState !== 'COMPLETED';
    },
    async handle(handlerInput) {
      const currentIntent = handlerInput.requestEnvelope.request.intent;
      const adresseHabituelle = await getAddress(user_id);

      if (currentIntent.slots.adresse.value == "habituelle") currentIntent.slots.adresse.value = adresseHabituelle;
      if (currentIntent.slots.quantite.value == undefined) currentIntent.slots.quantite.value = 1;

      const infosCmd = await simulateOrder(user_id, currentIntent.slots.quantite.value, currentIntent.slots.commande.value);
      currentIntent.slots.prixTotal.value = infosCmd.body.price + " €";

      return handlerInput.responseBuilder
        .addDelegateDirective(currentIntent)
        .getResponse();
    },
};

// Commande OK et adresse OK
const CompletedNouvelleCommandeIntentHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest'
        && request.intent.name === 'NouvelleCommandeIntent';
    },
    async handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;

        let sortieVocale = "";
        if (request.intent.confirmationStatus === 'CONFIRMED') {
            let qte = request.intent.slots.quantite.value;
            let pdct = request.intent.slots.commande.value;
            let estValide = await sendOrder(user_id, qte, pdct) == 201;

            const infosCmd = await simulateOrder(user_id, qte, pdct);

            let tempsLivraison = "Votre commande vous sera livrée dans " + infosCmd.body.deliveryETA + " minutes. ";
            let paiement = "Le paiement s'effectuera à la livraison. "
            if (await getPaiementCard(user_id)) { paiement = "Le paiement a été effectué. " }

            if (estValide) sortieVocale = "La commande est validée. " + paiement + tempsLivraison + "Bon appétit !";
            else sortieVocale = "Une erreur s'est produite. " + MESSAGE_REPROMPT;        
        }
        if (request.intent.confirmationStatus === 'DENIED') sortieVocale = "La commande est annulée. " + MESSAGE_REPROMPT;

        return handlerInput.responseBuilder
            .speak(sortieVocale)
            .reprompt(MESSAGE_REPROMPT)
            .getResponse();
    },
};


///////////////////////////////////////////// AUTRES /////////////////////////////////////////////

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder
            .speak(MESSAGE_AIDE)
            .reprompt(MESSAGE_REPROMPT)
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {

        return handlerInput.responseBuilder
            .speak(MESSAGE_FERMETURE)
            .getResponse();
    }
};

/* *
 * FallbackIntent triggers when a customer says something that doesn’t map to any intents in your skill
 * It must also be defined in the language model (if the locale supports it)
 * This handler can be safely added but will be ingnored in locales that do not support it yet
 * */
const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        const speakOutput = handlerInput.t('FALLBACK_MSG');

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

/* *
 * SessionEndedRequest notifies that a session was ended. This handler will be triggered when a currently open
 * session is closed for one of the following reasons: 1) The user says "exit" or "quit". 2) The user does not
 * respond or says something that does not match an intent defined in your voice model. 3) An error occurs
 * */
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`);
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse(); // notice we send an empty response
    }
};

/* *
 * The intent reflector is used for interaction model testing and debugging.
 * It will simply repeat the intent the user said. You can create custom handlers for your intents
 * by defining them above, then also adding them to the request handler chain below
 * */
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = handlerInput.t('REFLECTOR_MSG', {intentName: intentName});

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};

/**
 * Generic error handling to capture any syntax or routing errors. If you receive an error
 * stating the request handler chain is not found, you have not implemented a handler for
 * the intent being invoked or included it in the skill builder below
 * */
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(handlerInput);
        console.log(error);
        const speakOutput = handlerInput.t('ERROR_MSG');
        console.log(`~~~~ Error handled: ${JSON.stringify(error)}`);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

/**
 * This handler acts as the entry point for your skill, routing all request and response
 * payloads to the handlers above. Make sure any new handlers or interceptors you've
 * defined are included below. The order matters - they're processed top to bottom
 * */
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        SuggestionsIntentHandler,
        ErrorCommandeHabituelleIntentHandler,
        ErrorAdresseHabituelleCommandeHabituelleIntentHandler,
        ErrorProduitCommandeHabituelleIntentHandler,
        InProgressCommandeHabituelleIntentHandler,
        CompletedCommandeHabituelleIntentHandler,
        ErrorAdresseHabituelleNouvelleCommandeIntentHandler,
        ErrorProduitCommandeIntentHandler,
        InProgressNouvelleCommandeIntentHandler,
        CompletedNouvelleCommandeIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        FallbackIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler
    )
    .addErrorHandlers(ErrorHandler)
    .lambda();