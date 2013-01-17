/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

CURRENT_GAME = "currentGame";

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

var mutationObserver = {};

Meteor.startup(function (){

    mutationObserver = new MutationSummary({
        queries: [{element:'[data-role="page"]',elementAttributes:'class'},{element:'[data-role="listview"]'},{element:'li'},{element:'[data-role="button"]'}],
        callback: function(summaries) {
            refreshListviews();
        }
    });
});