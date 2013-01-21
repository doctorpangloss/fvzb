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
    //$.mobile.initializePage('[data-role="page"]');
}

var refreshListviews = function() {
    $('.ui-listview[data-role="listview"]').listview("refresh");
    $('[data-role="button"]:visible').button();
}

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

/*
* Templates
* */

Template.menu.created = createListviews;
Template.menu.rendered = refreshListviews;

Template.game.game = function() {
    var g = getGame(Session.get(CURRENT_GAME));
    if (g) {
        return _.extend(g,{
            roleName:Session.equals(CURRENT_ROLE,BUNNY) ? 'bunny' : 'farmer',
            allReady:g.bunny.ready && g.farmer.ready,
            waitingForPlayer:g.users.length < 2
        });
    } else {
        return null;
    }
}

Template.game.rendered = refreshListviews;

Template.intro.game = Template.game.game;
Template.intro.preserve({
    'div[id]':function(node) {
        return node.id;
    }
});
Template.intro.rendered = refreshListviews;

/**
 * Startup
 * **/

// Used to update jQueryMobile widgets
var mutationObserver = {};

Meteor.startup(function (){

    // Get current role (cannot be used to cheat, just a shortcut)
    Meteor.autorun(function () {
        var g = getGame(Session.get(CURRENT_GAME));

        if (!g)
            return BUNNY;

        var r = getRole(g,Meteor.userId());

        if (!r)
            return BUNNY;

        Session.set(CURRENT_ROLE,r);
    });

    // Refresh jQueryMobile interface on UI changes
    mutationObserver = new MutationSummary({
        queries: [{element:'[data-role="page"]',elementAttributes:'class'},{element:'[data-role="listview"]'},{element:'[data-role="button"]'}],
        callback: function(summaries) {
            refreshListviews();
        }
    });
});