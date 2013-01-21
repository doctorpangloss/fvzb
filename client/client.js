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
        if (r)
            Session.set(CURRENT_GAME,r);
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
    return getGame(Session.get(CURRENT_GAME));
}

Template.game.rendered = refreshListviews;

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

    mutationObserver = new MutationSummary({
        queries: [{element:'[data-role="page"]',elementAttributes:'class'},{element:'[data-role="listview"]'},{element:'[data-role="button"]'}],
        callback: function(summaries) {
            refreshListviews();
        }
    });
});