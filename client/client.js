/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

CURRENT_GAME = "currentGame";
CURRENT_ROLE = "currentRole";
CURRENT_GEM_SELECTION = "currentGemSelection";

/*
* GUI Helpers
* */

var createListviews = function() {
    $('[data-role="listview"]').listview();
}

var refreshJQueryMobile = function() {
    try {
        $('.ui-listview[data-role="listview"]').listview("refresh");
    } catch (e) {
        console.log(e);
    }
    try {
        $('[data-role="button"]:visible').button();
    } catch (e) {
        console.log(e);
    }
}

var idPreserver = {
    'div[id]':function(node) {
        return node.id;
    }
};

// @author Erik Z
// http://stackoverflow.com/questions/2750028/enable-disable-zoom-on-iphone-safari-with-javascript
var allowZoom = function(flag) {
    if (flag == true) {
        $('head meta[name=viewport]').remove();
        $('head').prepend('<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=10.0, minimum-scale=1, user-scalable=1" />');
    } else {
        $('head meta[name=viewport]').remove();
        $('head').prepend('<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=0" />');
    }
};

/*
* General
* */

var matchMake = function() {
    Meteor.call("startGame",function(e,r){
        if (r) {
            Session.set(CURRENT_GAME,r);
            $.mobile.changePage('#intro');
        }
        if (e)
            console.log(e);
    });
}

var imReady = function() {
    Meteor.call('ready',Session.get(CURRENT_GAME),function(e,r){
        if (e)
            console.log(e);
    });
}

var quit = function() {
    Session.set(CURRENT_GAME,"");
    Session.set(CURRENT_ROLE,"");
    // Disable zooming
    allowZoom(false);
}

/*
* Templates
* */

Template.menu.created = createListviews;
Template.menu.rendered = refreshJQueryMobile;

Template.game.game = function() {
    var g = getGame(Session.get(CURRENT_GAME));
    if (g && g.bunny) {
        return _.extend(g,{
            roleName:Session.equals(CURRENT_ROLE,BUNNY) ? 'bunny' : 'farmer',
            oppositeName:Session.equals(CURRENT_ROLE,BUNNY) ? 'farmer' : 'bunny',
            allReady:g.bunny.ready && g.farmer.ready,
            waitingForPlayer:g.users.length < 2,
            amITheWinner:Session.equals(CURRENT_ROLE, g.winner),
            winnerName:["","bunny","farmer"][g.winner]
        });
    } else {
        return null;
    }
}

Template.game.created = createListviews;
Template.game.rendered = refreshJQueryMobile;

Template.intro.game = Template.game.game;
Template.intro.preserve(idPreserver);
Template.intro.created = createListviews;
Template.intro.rendered = refreshJQueryMobile;

Template.winner.game = Template.game.game;
Template.winner.preserve(idPreserver);
Template.winner.created = createListviews;
Template.winner.rendered = refreshJQueryMobile;
/**
 * Startup
 * **/

// Used to update jQueryMobile widgets
var mutationObserver = {};

Meteor.startup(function (){
    // Get current role (cannot be used to cheat, just a shortcut)
    // Switch to winner screen if someone won
    Meteor.autorun(function () {
        var g = getGame(Session.get(CURRENT_GAME));

        if (!g)
            return BUNNY;

        var r = getRole(g,Meteor.userId());

        if (!r)
            return BUNNY;

        Session.set(CURRENT_ROLE,r);

        // The game is over
        if (g.winner) { /*Only a truthy value when set to a role*/
            // Switch to the winner screen if the game is over
            $.mobile.changePage('#winner');
            // Enable pinch to zoom for the comic
            allowZoom(true);
        }
    });

    // Subscribe to data streams
    Meteor.subscribe("games");
    Meteor.subscribe("users");
    Meteor.autosubscribe(function() {
        var gameId = Session.get(CURRENT_GAME);
        Meteor.subscribe("currentGame",gameId);
        Meteor.subscribe("gemsInGame",gameId);
        Meteor.subscribe("unitsInGame",gameId);
    });

    // Refresh jQueryMobile interface on UI changes
    mutationObserver = new MutationSummary({
        queries: [{element:'[data-role="page"]',elementAttributes:'class'},{element:'[data-role="listview"]'},{element:'[data-role="button"]'}],
        callback: function(summaries) {
            refreshJQueryMobile();
        }
    });
});