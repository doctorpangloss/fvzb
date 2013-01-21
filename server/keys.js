/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
Meteor.startup(function () {
    Accounts.loginServiceConfiguration.remove({});
    Accounts.loginServiceConfiguration.insert({
        service:"facebook",
        clientId:"472595072800650",
        appId:"	472595072800650",
        secret:"fe8c2120e3bf7a61f3eddb3cf94330b0",
        appSecret:"fe8c2120e3bf7a61f3eddb3cf94330b0"
    });

    Accounts.loginServiceConfiguration.insert({
        service:"google",
        clientId:"253853968266-1q5fsn1i1nka2ebvd9rr78m6pqp8o6qg.apps.googleusercontent.com",
        secret:"Nwshv0qIstGEJOAz1VPAFiYG",
        clientSecret:"Nwshv0qIstGEJOAz1VPAFiYG"
    });
});