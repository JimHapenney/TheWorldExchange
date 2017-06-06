/*
  All code below developed by pftq and distributed by Autodidactic I (www.autodidactic.ai).
  Do not use or distribute without permission.
  © 2016 The World Exchange | contact@theworldexchange.net
  
  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

var api = new ripple.RippleAPI({server:'wss://s1.ripple.com/'}); // s1.ripple.com, s-east.ripple.com, s-west.ripple.com
var dataAPI = "https://data.ripple.com";
var address = '';
var key = '';
var accuracy = 8;
var bookdepth = 8;
var showOrderbook = false;
var baseReserve = 20;
var baseIncrement = 5;
var baseFee = 5;
var baseCurrency = "XRP";
var minBaseCurrency = 40;
var updateInterval = 1; // seconds
var reconnectInterval = 30; // number of intervals before reconnecting to reset connection, reduces stale connections etc
var maxLedgerOffset = 100;
var maxFee = "2000";

var symbol1="";
var symbol2="";
var issuer1=""; 
var issuer2="";
var mktcapName1="";
var mktcapName2="";
var mktcap1=0;
var mktcap2=0;
var action = "";
var lastIssuer = "";
var destTag = "";

var numIntervals = -1;
var noDisconnecting = false;
var reconnecting = false;

var errored = false;

var majorIssuers = {
    "BTC": ["rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B"],
    "EUR": ["rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq"],
    "USD": ["rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B", "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq"]
};

var issuers = {
    "BTC": ["rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B"],
    "CNY": ["rKiCet8SdvWxPXnAgYarFUXMh1zCPz432Y"],
    "ETH": ["rcA8X3TVMST1n3CJeAdGk1RdRCHii7N2h"],
    "EUR": ["rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq"],
    "GBP": ["rBycsjqxD8RVZP5zrrndiVtJwht7Z457A8"],
    "JPY": ["r9ZFPSb1TFdnJwbTMYHvVwFK1bQPUCVNfJ"],
    "KRW": ["rPxU6acYni7FcXzPCMeaPSwKcuS2GTtNVN"],
    "USD": ["rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B", "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq", "rMwjYedjc7qqtKYVLiAccJSmCwih4LnE2q"],
    "XAG": ["r9Dr5xwkeLegBeXq6ujinjSBLQzQ1zQGjH"],
    "XAU": ["r9Dr5xwkeLegBeXq6ujinjSBLQzQ1zQGjH"],
    "XRP": []
};

var issuerNames = {
    "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B":"Bitstamp",
    "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq":"Gatehub",
    "rKiCet8SdvWxPXnAgYarFUXMh1zCPz432Y":"Ripplefox",
    "rcA8X3TVMST1n3CJeAdGk1RdRCHii7N2h":"Gatehub Fifth",
    "rBycsjqxD8RVZP5zrrndiVtJwht7Z457A8":"Ripula",
    "r9ZFPSb1TFdnJwbTMYHvVwFK1bQPUCVNfJ":"Ripple Exch Tokyo",
    "rPxU6acYni7FcXzPCMeaPSwKcuS2GTtNVN":"EXRP",
    "r9Dr5xwkeLegBeXq6ujinjSBLQzQ1zQGjH":"Ripple Singapore",
    "rDVdJ62foD1sn7ZpxtXyptdkBSyhsQGviT":"Ripple Dividend",
    "rMwjYedjc7qqtKYVLiAccJSmCwih4LnE2q":"Snapswap"
};

var trustlines = {
  
};

var holdings = {
    "XRP":0
};

function nFormatter(num, digits) {
  try {
    var si = [
      { value: 1E18, symbol: "E" },
      { value: 1E15, symbol: "P" },
      { value: 1E12, symbol: "T" },
      { value: 1E9,  symbol: "B" },
      { value: 1E6,  symbol: "M" },
      //{ value: 1E3,  symbol: "k" }
    ], rx = /\.0+$|(\.[0-9]*[1-9])0+$/, i;
    for (i = 0; i < si.length; i++) {
      if (num >= si[i].value) {
        return (num / si[i].value).toFixed(digits).replace(rx, "$1") + si[i].symbol;
      }
    }
    return num.toFixed(digits).replace(rx, "$1");
  }
  catch (err) { return num; }
  return num;
}

function updateLoginMessage() {
  if(address!="") {
    $("#welcome").css("display", "none");
    $("#yourAccount").css("display", "block");
  }
  else {
    $("#welcome").css("display", "block");
    $("#yourAccount").css("display", "none");
  }
}

function loadAccount(loadOrderbookNext=false) {
  new Promise(function(resolve, reject) { 
    var temp = $("#account").val();
    if(temp!=address) {
      address = $("#account").val();
      Cookies.set('accountAddr', address, { expires: 7 });
      updateSymbol1();
      if(address!="") {
        if(!(address in issuerNames)) issuerNames[address] = "You";
      }
      //console.log("Address: "+address);
    }
    updateLoginMessage();
    
    if(!reconnecting) {
      reconnecting = true;
      try {
        if(api.isConnected()) {
          reconnecting = false;
          resolve();
        }
        else {
          console.log('Disconnected in loadAccount.');
          try {
            api.connect().then(function() {
                console.log("Reconnected in loadAccount.");
                reconnecting = false;
                resolve();
            }, function (err) {
              console.log("Failed to reconnect in loadAccount: "+err);
              reconnecting = false;
              resolve();
            });
          }
          catch (er) {
            console.log("Failed to reconnect in loadAccount: "+er);
            reconnecting = false;
            resolve();
          }
        }
      }
      catch (erx) {
        console.log("Error in loadAccount API: "+erx);
        reconnecting = false;
        resolve();
      }
    }
    else setTimeout(resolve, 5000);
    
    }, function (err) {
      console.log("Error in loadAccount: "+err);
    }).then(function() { 
      if(address=="" || !api.isConnected()) return "";
      else {
        var info = "";
        try {
          info = api.getAccountInfo(address); 
        }
        catch (err) {
          console.log("Error getAccountInfo: "+err);
        }
        return info;
      }
    }, function(err) { console.log("Error getAccountInfo: "+err); return ""; }).then(function(info) {
      if(info) {
        minBaseCurrency = baseReserve + baseIncrement*info.ownerCount;
      }
    }, function(err) { console.log("Error loading minBaseCurrency: "+err); }).then(function() { 
      if(address=="" || !api.isConnected()) return "";
      else {
        var balances = "";
        try {
          balances = api.getBalances(address); 
        }
        catch (err) {
          console.log("Error getBalances: "+err);
        }
        return balances;
      }
    }, function(err) { console.log("Error getBalances: "+err); return ""; }).then(function(balances) {
        var balanceOutput = "";
        if(balances && address!="" && balances.length>0) {
          holdings = {};
          holdings[baseCurrency]=0;
          for(var i=0; i<balances.length; i++) {
            if(balances[i].value==0) continue;
            if(balanceOutput!="") balanceOutput+=", ";
            var counterparty = ""+balances[i].counterparty;
            if(balances[i].value<0) counterparty = address;
            var s = balances[i].currency + (counterparty!="undefined" && (!(balances[i].currency in issuers) || (issuers[balances[i].currency].length>0))? "."+counterparty:"");
            if(!(balances[i].currency in issuers)) {
              issuers[balances[i].currency] = [];
              var symbolsList = symbolLister();
              $("#symbol1").autocomplete({ source:symbolsList});
              $("#symbol2").autocomplete({ source:symbolsList});
            }
            if(counterparty!="undefined" && balances[i].currency!=baseCurrency && $.inArray(counterparty, issuers[balances[i].currency])==-1) {
              issuers[balances[i].currency][issuers[balances[i].currency].length] = counterparty;
            }
            
            holdings[s] = parseFloat(balances[i].value);
            var act = holdings[s]>0? "sell":"buy";
            var qty = Math.abs(holdings[s]);
            
            balanceOutput+="<a target='_blank' href='?qty1="+qty+"&amp;symbol1="+s+"' onclick='loadURLSymbol(\"\", "+qty+", \""+s+"\"); return false;'>"+parseFloat(holdings[s].toFixed(holdings[s]>1? 2:4)).toString()+" "+balances[i].currency+"</a>";
          }
        }
        if(holdings.length<=1 && holdings[baseCurrency]<minBaseCurrency) {
          console.log("No results from getBalances.");
          console.log(balances);
        }
        else if(balanceOutput!="") {
          $("#balanceLabel").css("visibility", "visible");
          $("#balanceLabel").css("display", "block");
          $("#balance").css("display", "block");
          $("#balance").html(""+balanceOutput);
        }
        else {
          $("#balanceLabel").css("visibility", "hidden");
          $("#balanceLabel").css("display", "none");
          $("#balance").css("display", "none");
          $("#balance").html("");
        }
    }, function(err) {
      console.log("Error building balances: "+err);
  }).then(function() { 
    if(address=="" || !api.isConnected()) return "";
    else {
        var orders = "";
        try {
          orders = api.getOrders(address);
        }
        catch(err) {
          console.log("Error getOrders: "+err); 
        }
        return orders;
      }
  }, function(err) {console.log("Error getOrders: "+err); return ""; }).then(function(orders) {
    var ordersOutput = "";
    if(address!="" && orders!="") {
      for(var i=0; i<orders.length; i++) {
        if(ordersOutput!="") ordersOutput+="<br /> ";
        var direction = orders[i].specification.direction;
        var counterparty1 = ""+orders[i].specification.quantity.counterparty;
        if(counterparty1==address) direction = "issue";
        var counterparty2 = ""+orders[i].specification.totalPrice.counterparty;
        var qty = parseFloat(orders[i].specification.quantity.value);
        var symbol1 = ""+orders[i].specification.quantity.currency;
        var symbol2 = ""+orders[i].specification.totalPrice.currency;
        var price = parseFloat(orders[i].specification.totalPrice.value)/parseFloat(orders[i].specification.quantity.value);
        var s1 = symbol1 + (counterparty1!="undefined" && (!(symbol1 in issuers) || (issuers[symbol1].length>0))? "."+counterparty1:"");
        var s2 = symbol2 + (counterparty2!="undefined" && (!(symbol2 in issuers) || (issuers[symbol2].length>0))? "."+counterparty2:"");
        var orderSeq = orders[i].properties.sequence;
        
        ordersOutput+="<span style='white-space:nowrap;'><a href='#' onclick='cancelOrder("+orderSeq+"); this.style.display = \"none\"'>[X]</a> <a target='_blank' href='?action="+direction+"&amp;qty1="+qty+"&amp;symbol1="+s1+"&amp;price="+price+"&amp;symbol2="+s2+"' onclick='loadURLSymbols(\""+direction+"\", "+qty+", \""+s1+"\", "+price+", \""+s2+"\"); return false;'>"+direction+" "+parseFloat(qty.toFixed(qty>1? 2:4)).toString()+" "+symbol1+" @ "+parseFloat(price.toFixed(price>1? 2:4)).toString()+" "+symbol2+"</a></span>";
      }
    }
    if(ordersOutput!="") {
      $("#ordersLabel").css("visibility", "visible");
      $("#ordersLabel").css("display", "block");
      $("#orders").css("display", "block");
      $("#orders").css("visibility", "visible");
      $("#orders").html(""+ordersOutput);
    }
    else {
      $("#ordersLabel").css("visibility", "hidden");
      $("#ordersLabel").css("display", "none");
      $("#orders").css("display", "none");
      $("#orders").css("visibility", "hidden");
      $("#orders").html("");
    }
  }, function(er) { console.log("Error building orders: "+er); }).then(function() {
    if(address!="") {
      $("#history").html("<div><a href='#started' onclick='gettingStarted();'>Min "+baseCurrency+": "+minBaseCurrency.toString()+"</a> | <a href='https://bithomp.com/explorer/"+address+"' target='_blank'>View Account History</a></div><div><a href='#' onclick='showTrustlines();'>Set What Others Can Send You</a></div><div><a href='#started' onclick='gettingStarted();'>How to Fund / Deposit</a></div>");
      checkMinBaseCurrency();
      //refreshLayout();
    }
    else {
      $("#balanceLabel").css("display", "hidden");
      $("#balanceLabel").css("display", "block");
      $("#balance").css("display", "block");
      $("#history").html("");
    }
  }, function(er) { console.log("Error printing orders: "+er); }).then(function() {
    if(api.isConnected() && loadOrderbookNext && !noDisconnecting && !reconnecting) {
      if(numIntervals>=reconnectInterval) {
        numIntervals = 0;
        return api.disconnect();
      }
      else numIntervals++;
    }
  }, function(er) { console.log("Error disconnecting after loadAccount: "+er); }).then(function() {
    if(loadOrderbookNext) {
      setTimeout(loadOrderbook, updateInterval*1000);
    }
  }, function(err) { 
      console.log("Error completing account load: "+err);
      if(loadOrderbookNext) {
        setTimeout(loadOrderbook, updateInterval*1000);
      } 
  });
}

function gettingStarted() {
  $("#about").css("display", "block"); 
  jQuery("html,body").animate({scrollTop: jQuery("#started").offset().top}, 1000);
  setURL("#started");
  return false;
}

function checkMinBaseCurrency() {
  if(holdings[baseCurrency]<minBaseCurrency) {
    $("#balanceLabel").css("display", "hidden");
    $("#balanceLabel").css("display", "block");
    $("#balance").css("display", "block");
    $("#balance").html("Your account needs <a href='#started' onclick='gettingStarted();'>>= "+minBaseCurrency+" "+baseCurrency+"</a>.");
  }
}

function symbolLister() {
  var result = [];
  for(var symbol in issuers)
    if($.inArray(symbol, result) === -1) result.push(symbol);
  result.sort();
  return result;
}

function getPair() {
  var pair = {};
  pair.base = {};
  pair.counter = {};
  pair.base.currency = symbol1;
  pair.counter.currency = symbol2;
  
  if(issuer1!="" && symbol1!=baseCurrency && (!(symbol1 in issuers) || $.inArray(issuer1, issuers[symbol1])>-1)) pair.base.counterparty=issuer1;
  if(issuer2!="" && symbol2!=baseCurrency && (!(symbol2 in issuers) || $.inArray(issuer2, issuers[symbol2])>-1)) pair.counter.counterparty=issuer2;
  
  //console.log(pair.base.currency+"."+pair.base.counterparty+" vs "+pair.counter.currency+"."+pair.counter.counterparty);
  
  return pair;
}

function getSelectedText() {
    var text = "";
    if (typeof window.getSelection != "undefined") {
        text = window.getSelection().toString();
    } else if (typeof document.selection != "undefined" && document.selection.type == "Text") {
        text = document.selection.createRange().text;
    }
    return text;
}

function loadOrderbook() {
  try {
  //console.log("orderbook-entry: "+showOrderbook+", symbol1="+symbol1+", symbol2="+symbol2);
  new Promise(function(resolve, reject) {
    if(!reconnecting) {
      reconnecting = true;
      try {
        if(api.isConnected()) {
          reconnecting = false;
          resolve();
        }
        else {
          console.log('Disconnected in loadOrderbook.');
          try {
            api.connect().then(function() {
                console.log("Reconnected in loadOrderbook.");
                reconnecting = false;
                resolve();
            }, function (err) {
              console.log("Failed to reconnect in loadOrderbook: "+err);
              reconnecting = false;
              resolve();
            });
          }
          catch (er) {
            console.log("Failed to reconnect in loadOrderbook: "+er);
            reconnecting = false;
            resolve();
          }
        }
      }
      catch (erx) {
        console.log("Error in loadOrderbook API: "+erx);
        reconnecting = false;
        resolve();
      }
    }
    else setTimeout(resolve, 5000);
    
  }, function (err) {
      console.log("Error in loadOrderbook: "+err);
      console.log("Restarting refresh cycle...");
      setTimeout(loadOrderbook, updateInterval*1000);
  }).then(function() {
    if(showOrderbook && getSelectedText()=="") updateSymbols();
  }, function(err) { console.log("Error updating symbols before orderbook: "+err); }).then(function() { if(api.isConnected() && showOrderbook && getSelectedText()=="") {
    try {
      if(!errored && $.trim( $('#orderbook').html() ).length) {
        if(action!="issue") {
          $("#errors").html("&nbsp;");
          refreshLayout();
        }
        else if($('#orderbook').html()!="Share the below link to let others trade your "+symbol1+":<br /><input type='text' value='https://www.theworldexchange.net/?symbol1="+symbol1+"."+address+"&amp;symbol2="+symbol2+"."+issuer2+"' onclick='this.select();' readonly='readonly' class='linkShare' />") {
          $("#errors").html("Share the below link to let others trade your "+symbol1+":<br /><input type='text' value='https://www.theworldexchange.net/?symbol1="+symbol1+"."+address+"&amp;symbol2="+symbol2+"."+issuer2+"' onclick='this.select();' readonly='readonly' class='linkShare' />");
          refreshLayout();
        }
      }
      bookdepth = Math.max(3, Math.round((($('#container').height()- $("#topHalf").height() - $('#trade').outerHeight() - $("#errors").outerHeight() - $("footer").height())*.8)/($('#trade').height())));
      
      //if( /iPhone/i.test(navigator.userAgent) ) return null; // broken on iphone, freezes
      
      return api.getOrderbook(address=="" || address.length<=10?  Object.keys(issuerNames)[0]:address, getPair(), {limit:bookdepth+5}); 
    }
    catch (ex) {
      showOrderbook = false;
      if(action!="issue") {
        $("#errors").html("No orderbook for symbols "+symbol1+" / "+symbol2+" found. Check spelling or issuer/backer.");
        errored = true;
      }
      //refreshLayout();
    }
    }
    else return null;
  }, function (err) {
      console.log("Error in api.loadOrderbook: "+err);
      return null;
  }).then(function(orderbook) {
    //console.log(orderbook);
    if(showOrderbook && orderbook!=null) {
      var bidasktable = "";
  
      var cols = 6;
      bidasktable += "<table><tr><td colspan='"+(cols-1)+"' style='text-align:left;'>Bids</td><td colspan='3' style='text-align:center; overflow:hidden;'><a href='?action="+(action=="sell"? "buy":"sell")+"&amp;qty1="+($("#qty1").val()*$("#price").val())+"&amp;symbol1="+symbol2+(issuer2==""? "":"."+issuer2)+"&amp;price="+(1/$("#price").val())+"&amp;symbol2="+symbol1+(issuer1==""? "":"."+issuer1)+"' target='_blank' onclick='loadURLSymbols(\""+(action=="sell"? "buy":"sell")+"\", $(\"#qty1\").val()*$(\"#price\").val(), \""+symbol2+(issuer2==""? "":"."+issuer2)+"\", 1/$(\"#price\").val(), \""+symbol1+(issuer1==""? "":"."+issuer1)+"\"); return false;'>Switch</a> </td><td colspan='"+(cols-1)+"' style='text-align:right;'>Asks</td></tr>";
      
      var bids = [];
      var asks = [];
      var bidTotal = 0;
      var askTotal = 0;
      
      for(var i=0; i<Math.max(orderbook.bids.length, orderbook.asks.length); i++) {

         if(i<orderbook.bids.length && orderbook.bids[i].specification.quantity.value!=0) {
          var row1 = ""; var bid = 0; var q1 = 0; var counterparty = ""; var counterparty2 = ""; var s1 = ""; var s2="";
          if(orderbook.bids[i].state!=null && orderbook.bids[i].state.fundedAmount!=null && orderbook.bids[i].state.fundedAmount.value>0) {
             bid = (1.00000000*orderbook.bids[i].specification.totalPrice.value)/(1.00000000*orderbook.bids[i].specification.quantity.value);
             counterparty = ""+orderbook.bids[i].specification.quantity.counterparty;
             counterparty2 = ""+orderbook.bids[i].specification.totalPrice.counterparty;
             q1=orderbook.bids[i].state.fundedAmount.value / bid;
             s1 = orderbook.bids[i].specification.quantity.currency + (counterparty!="undefined" && (!(orderbook.bids[i].specification.quantity.currency in issuers) || (issuers[orderbook.bids[i].specification.quantity.currency].length>0))? "."+counterparty:"");
             s2 = orderbook.bids[i].specification.totalPrice.currency + (counterparty2!="undefined" && (!(orderbook.bids[i].specification.totalPrice.currency in issuers) || (issuers[orderbook.bids[i].specification.totalPrice.currency].length>0))? "."+counterparty2:"");
            
          }
          else {
             bid = (1.00000000*orderbook.bids[i].specification.totalPrice.value)/(1.00000000*orderbook.bids[i].specification.quantity.value);
             counterparty = ""+orderbook.bids[i].specification.quantity.counterparty;
             counterparty2 = ""+orderbook.bids[i].specification.totalPrice.counterparty;
             q1=orderbook.bids[i].specification.quantity.value;
             s1 = orderbook.bids[i].specification.quantity.currency + (counterparty!="undefined" && (!(orderbook.bids[i].specification.quantity.currency in issuers) || (issuers[orderbook.bids[i].specification.quantity.currency].length>0))? "."+counterparty:"");
             s2 = orderbook.bids[i].specification.totalPrice.currency + (counterparty2!="undefined" && (!(orderbook.bids[i].specification.totalPrice.currency in issuers) || (issuers[orderbook.bids[i].specification.totalPrice.currency].length>0))? "."+counterparty2:"");
             
          }
            
            bids[bids.length] = {direction:orderbook.bids[i].specification.direction, counterparty:counterparty, counterparty2:counterparty2, qty:parseFloat(q1), symbol1complete:s1, symbol2complete:s2, symbol1:orderbook.bids[i].specification.quantity.currency, symbol2:orderbook.bids[i].specification.totalPrice.currency, price:(bid).toFixed(accuracy)};
            bidTotal+=parseFloat(q1);
        }
        
        if(i< orderbook.asks.length && orderbook.asks[i].specification.quantity.value!=0) {
          var row2 = ""; var ask = 0; var counterparty = ""; var counterparty2 = ""; var q1 = 0; var s1 = ""; var s2 = "";
          if(orderbook.asks[i].state!=null && orderbook.asks[i].state.fundedAmount!=null && orderbook.asks[i].state.fundedAmount.value>0) {
             ask = (1.00000000*orderbook.asks[i].specification.totalPrice.value)/(1.00000000*orderbook.asks[i].specification.quantity.value);
             counterparty = ""+orderbook.asks[i].specification.quantity.counterparty;
             counterparty2 = ""+orderbook.asks[i].specification.totalPrice.counterparty;
             q1=orderbook.asks[i].state.fundedAmount.value;
             s1 = orderbook.asks[i].specification.quantity.currency + (counterparty!="undefined" && (!(orderbook.asks[i].specification.quantity.currency in issuers) || (issuers[orderbook.asks[i].specification.quantity.currency].length>0))? "."+counterparty:"");
             s2 = orderbook.asks[i].specification.totalPrice.currency + (counterparty2!="undefined" && (!(orderbook.asks[i].specification.totalPrice.currency in issuers) || (issuers[orderbook.asks[i].specification.totalPrice.currency].length>0))? "."+counterparty2:"");
          }
          else {
             ask = (1.00000000*orderbook.asks[i].specification.totalPrice.value)/(1.00000000*orderbook.asks[i].specification.quantity.value);
             counterparty = ""+orderbook.asks[i].specification.quantity.counterparty;
             counterparty2 = ""+orderbook.asks[i].specification.totalPrice.counterparty;
             q1=orderbook.asks[i].specification.quantity.value;
             s1 = orderbook.asks[i].specification.quantity.currency + (counterparty!="undefined" && (!(orderbook.asks[i].specification.quantity.currency in issuers) || (issuers[orderbook.asks[i].specification.quantity.currency].length>0))? "."+counterparty:"");
             s2 = orderbook.asks[i].specification.totalPrice.currency + (counterparty2!="undefined" && (!(orderbook.asks[i].specification.totalPrice.currency in issuers) || (issuers[orderbook.asks[i].specification.totalPrice.currency].length>0))? "."+counterparty2:"");
          }
          
          asks[asks.length] = {direction:orderbook.asks[i].specification.direction, counterparty:counterparty, counterparty2:counterparty2, qty:parseFloat(q1), symbol1complete:s1, symbol2complete:s2, symbol1:orderbook.asks[i].specification.quantity.currency, symbol2:orderbook.asks[i].specification.totalPrice.currency, price:(ask).toFixed(accuracy)};
          askTotal+=parseFloat(q1);
        }
      }
      
      bids.sort(function(a,b) {
          return  b.price - a.price;
      });
      asks.sort(function(a,b) {
          return a.price - b.price;
      });
      
      var aggregatedBids = [];
      var aggregatedAsks = [];
      for(var i=0; i<bids.length; i++) {
        if(aggregatedBids.length==0 || aggregatedBids[aggregatedBids.length-1].price!=bids[i].price)
          aggregatedBids[aggregatedBids.length] = bids[i];
        else aggregatedBids[aggregatedBids.length-1].qty+=bids[i].qty;
      }
      for(var i=0; i<asks.length; i++) {
        if(aggregatedAsks.length==0 || aggregatedAsks[aggregatedAsks.length-1].price!=asks[i].price)
          aggregatedAsks[aggregatedAsks.length] = asks[i];
        else aggregatedAsks[aggregatedAsks.length-1].qty+=asks[i].qty;
      }
      bids = aggregatedBids;
      asks = aggregatedAsks;
      
      //console.log(bids);
      //console.log(asks);
      
      for(var j=0; j<Math.min(bookdepth, Math.max(bids.length, asks.length)); j++) {
        var bidurl = j>=bids.length? "":"<a target='_blank' href='?action=sell&amp;qty1="+(bids[j].qty)+"&amp;symbol1="+bids[j].symbol1complete+"&amp;price="+parseFloat(parseFloat(bids[j].price)-0.0000001)+"&amp;symbol2="+bids[j].symbol2complete+"' onclick='loadURLSymbols(\"sell\", "+bids[j].qty+", \""+bids[j].symbol1complete+"\", "+parseFloat(parseFloat(bids[j].price)-0.0000001)+", \""+bids[j].symbol2complete+"\"); return false;'>";
        var bidurlprice = j>=bids.length? "":"<a target='_blank' href='?action=sell&amp;qty1="+(bids[j].qty)+"&amp;symbol1="+bids[j].symbol1complete+"&amp;price="+parseFloat(parseFloat(bids[j].price)-0.0000001)+"&amp;symbol2="+bids[j].symbol2complete+"' onclick='loadURLSymbols(\"sell\", "+bids[j].qty+", \""+bids[j].symbol1complete+"\", "+parseFloat(parseFloat(bids[j].price)-0.0000001)+", \""+bids[j].symbol2complete+"\"); return false;'>";
        var askurl = j>=asks.length? "":"<a target='_blank' href='?action=buy&amp;qty1="+(asks[j].qty)+"&amp;symbol1="+asks[j].symbol1complete+"&amp;price="+parseFloat(parseFloat(asks[j].price)+0.0000001)+"&amp;symbol2="+asks[j].symbol2complete+"' onclick='loadURLSymbols(\"buy\", "+asks[j].qty+", \""+asks[j].symbol1complete+"\", "+parseFloat(parseFloat(asks[j].price)+0.0000001)+", \""+asks[j].symbol2complete+"\"); return false;'>";
        var askurlprice = j>=asks.length? "":"<a target='_blank' href='?action=buy&amp;qty1="+(asks[j].qty)+"&amp;symbol1="+asks[j].symbol1complete+"&amp;price="+parseFloat(parseFloat(asks[j].price)+0.0000001)+"&amp;symbol2="+asks[j].symbol2complete+"' onclick='loadURLSymbols(\"buy\", "+asks[j].qty+", \""+asks[j].symbol1complete+"\", "+parseFloat(parseFloat(asks[j].price)+0.0000001)+", \""+asks[j].symbol2complete+"\"); return false;'>";
        
        bidasktable += "<tr>" 
        +(j<bids.length? 
        "<td>"+bidurl+""+bids[j].direction+"</a></td>"
        +"<td>"+bidurl+""+nFormatter(parseFloat(bids[j].qty.toFixed(Math.max(0, accuracy-2-Math.round(bids[j].qty).toString().length))), 4)+"</a></td>"
        +"<td>"+bids[j].symbol1+"</td>"
        +"<td>@</td>"
        +"<td>"+bidurlprice+nFormatter(parseFloat(parseFloat(bids[j].price).toFixed(Math.max(0, accuracy-Math.round(bids[j].price).toString().length))), accuracy)+"</a></td>"
        +"<td style='text-align; left;'>"+bids[j].symbol2+"</td>"
        :"<td colspan='"+cols+"'> </td>")
        +"<td style='width:5%;'> </td>"
        +(j<asks.length? 
        "<td>"+askurl+""+asks[j].direction+"</a></td>"
        +"<td>"+askurl+""+nFormatter(parseFloat(asks[j].qty.toFixed(Math.max(0, accuracy-2-Math.round(asks[j].qty).toString().length))), 4)+"</a></td>"
        +"<td>"+asks[j].symbol1+"</td>"
        +"<td>@</td>"
        +"<td>"+askurlprice+nFormatter(parseFloat(parseFloat(asks[j].price).toFixed(Math.max(0, accuracy-Math.round(asks[j].price).toString().length))), accuracy)+"</a></td>"
        +"<td style='text-align; left;'>"+asks[j].symbol2+"</td>"
        :"<td colspan='"+cols+"'> </td>")+"</tr>";
      }
      

        if((mktcap1==0 || mktcapName1!=symbol1+"."+issuer1)) {
          if(symbol1!=baseCurrency) {
            var url = dataAPI+"/v2/capitalization/"+symbol1+"+"+issuer1+"?limit=1&descending=true";
            $.get( url, function( data ) {
                try {
                  mktcap1 = parseFloat(data.rows[0].amount).toFixed(0);
                  mktcapName1=symbol1+"."+issuer1;
                }
                catch (err) { 
                  mktcap1=0;
                }
            }, "json" );
            if(mktcap1<askTotal) mktcap1 = askTotal;
          }
          else {
            var url = dataAPI+"/v2/network/xrp_distribution?limit=1&descending=true";
            $.get( url, function( data ) {
                try {
                  mktcap1 = parseFloat(data.rows[0].distributed).toFixed(0);
                  mktcapName1=symbol1+"."+issuer1;
                }
                catch (err) { 
                  mktcap1=0; 
                }
            }, "json" );
          }
        }
        if((mktcap2==0 || mktcapName2!=symbol2+"."+issuer2)) {
          if(symbol2!=baseCurrency) {
            var url = dataAPI+"/v2/capitalization/"+symbol2+"+"+issuer2+"?limit=1&descending=true";
            $.get( url, function( data ) {
                try {
                  mktcap2 = parseFloat(data.rows[0].amount).toFixed(0);
                  mktcapName2=symbol2+"."+issuer2;
                }
                catch (err) {
                  mktcap2=0;
                }
            }, "json" );
          }
          else {
            var url = dataAPI+"/v2/network/xrp_distribution?limit=1&descending=true";
            $.get( url, function( data ) {
                try {
                  mktcap2 = parseFloat(data.rows[0].total).toFixed(0);
                  mktcapName2=symbol1+"."+issuer2;
                }
                catch (err) { 
                  mktcap2=0;
                }
            }, "json" );
          }
        }
      
      bidasktable+="<tr><td colspan='"+(cols-1)+"' style='text-align:left; border-width:0px;'>Total "+symbol2+" Issued: "+nFormatter(mktcap2, 2)+"</td><td colspan='3' style='border-width:0; text-align:center; overflow:hidden;'>"+new Date(Date.now()).toLocaleTimeString('en-GB')+"</td><td colspan='"+(cols-1)+"' style='text-align:right; border-width:0px;'>Total "+symbol1+" Issued: "+nFormatter(mktcap1, 2)+"</td></tr>";
      
      bidasktable += "</table>";
      
      return bidasktable;
    }
    else return ""; 
  }, function(err) { console.log("Error building orderbook info: "+err); return ""; }).then(function(bidasktable) {
      //console.log("orderbook-end: "+showOrderbook);
      if(getSelectedText()=="") {
        if(showOrderbook) {
          if(true) {
            var change = (bidasktable!="") && ($('#orderbook').html()=="");
            if(bidasktable!="") $("#orderbook").html(bidasktable);
            if(change) refreshLayout();
          }
        }
        else {
          var empty =  !$.trim( $('#orderbook').html() ).length;
          if(!empty) {
            //console.log("Empty orderbook.");
            $("#orderbook").html("");
            refreshLayout();
          }
        }
      }
     
    try {
      loadAccount(true);
    }
    catch(err) {
      console.log("Error loading account from interval refresh: "+err);
    }
    
  }, function(err) { console.log("Error finishing orderbook: "+err); });
  
  }
  catch (exxx) {
    console.log("Uncaught exception in loadOrderbook: "+exxx);
    console.log("Restarting orderbook refresh...");
    setTimeout(loadOrderbook, updateInterval*1000);
  }
}

function updateURL() {
  history.pushState(null, null, "/?"+(action=="buy"? "":"action="+action+"&")+"symbol1="+symbol1+(issuer1==""? "":"."+issuer1)+($("#qty1").val()==""? "":"&qty1="+$("#qty1").val())+(action=="send"? ($("#recipient").val()==""? "":"&recipient="+$("#recipient").val()):"&symbol2="+symbol2+(issuer2==""? "":"."+issuer2)+($("#price").val()!=""? "&price="+$("#price").val():"")));
}

function setURL(url) {
  history.pushState(null, null, "/"+url);
}

function updateAction() {
    
    var aSelect = document.getElementById('action');
    action = document.getElementById('action').value;
    
    var symParts = document.getElementById('symbol1').value.split('.');
    document.getElementById('symbol1').value=symParts[0].toUpperCase()+(symParts.length>1? "."+symParts[1]:"");
    var urlIssuer1="";
    if(symParts.length>1) {
      urlIssuer1 = symParts[1];
    }
    
    errored = false;
    
    if(action=='issue') {
      $("#symbol1").autocomplete({source: []});
      if($("#symbol1").val()==baseCurrency || (issuer1!=address && urlIssuer1!=address)) $("#symbol1").val("");
      lastIssuer = issuer1;
    }
    else {
      var symbolsList = symbolLister();
      $("#symbol1").autocomplete({ source:symbolsList});
      if($("#symbol1").val()=="" && lastIssuer=="") $("#symbol1").val(baseCurrency);
      if(lastIssuer!="") issuer1 = lastIssuer;
    }
    
    if(action=='send') {
        document.getElementById('recipientField').style.display = 'inline';
        document.getElementById('counterparty').style.display = 'none';
        document.getElementById('destinationTagLabel').style.display = 'inline';
        document.getElementById('backedby2').style.display = 'none';
        document.getElementById('issuer2').style.display = 'none';
        showOrderbook = false;
        updateSymbol1();
        //document.getElementById('issuer2Width').style.opacity = 0;
        $("#errors").html("Send to others by inputting their account address above.<br /><br />To receive or let others send to you, share the below link:<br /><input type='text' value='https://www.theworldexchange.net/?action=send&amp;recipient="+address+"' onclick='this.select();' readonly='readonly' class='linkShare' />");
    } else {
        document.getElementById('recipientField').style.display = 'none';
        document.getElementById('counterparty').style.display = 'inline';
        document.getElementById('destinationTagLabel').style.display = 'none';
        document.getElementById('backedby2').style.display = 'inline';
        document.getElementById('issuer2').style.display = 'inline';
        showOrHideOrderbook();
        updateSymbols();
        if(action=='issue' && symbol1=="") 
          $("#errors").html("Issue your own symbol for others trade and represent anything you can think of.<br />Symbols must be exactly 3 letters and cannot be 'XRP'.<br /><br />Learn more in: <a href='#represent' onclick='document.getElementById(\"about\").style.display=\"block\"; setURL(\"#represent\"); jQuery(\"html,body\").animate({scrollTop: jQuery(\"#represent\").offset().top}, 1000);'>What is The World Exchange?</a>");
    }
    refreshLayout();
}

function updateSymbols() {
  updateSymbol1();
  updateSymbol2();
}

function updateSymbol1() {
  
  var symParts = document.getElementById('symbol1').value.split('.');
  document.getElementById('symbol1').value=symParts[0].toUpperCase()+(symParts.length>1? "."+symParts[1]:"");
  
  symbol1=symParts[0].toUpperCase();
  
  if(symParts.length>1) {
    issuer1 = symParts[1];
    document.getElementById('symbol1').value = symbol1;
  }
  //else issuer1 = "";
  
  if(symbol1!="") {
    if(action=="issue") {
      issuer1=address;
    }
    else if(symbol1 in issuers && issuers[symbol1].length>0 && issuer1=="") { 
      if(issuer2!="" && $.inArray(issuer2, issuers[symbol1])>-1) issuer1 = issuer2;
      else issuer1=issuers[symbol1][0];
    }
    else if(!(symbol1 in issuers) && issuer1=="") issuer1 = "[ Enter Address ]";
  }
  
  if(symbol1==baseCurrency || (symbol1 in issuers && issuers[symbol1].length==0)) issuer1="";
  
  if(issuer1!="" || action =="issue") {
    $("#issuer1Label").css("visibility", "visible");
    $("#issuer1").html("<a href='#' onclick='"+(action=="issue"? "showIssuerYou();":"showIssuer1();")+"'>"+(issuer1==address || action=="issue" ? "You":(issuer1 in issuerNames? issuerNames[issuer1]:issuer1))+"</a>");
  }
  else {
    $("#issuer1Label").css("visibility", "hidden");
    $("#issuer1").html("");
  }
  
  if(symbol1!="" && action=="issue" && issuer1=="" && address!="") {
    $("#errors").html("Invalid symbol to issue. Choose a different name to issue your own symbol.");
    errored = true;
  }
  else if(symbol1.length>0 && symbol1.length!=3) {
    $("#errors").html("Symbols must be exactly 3 letters.");
    errored = true;
    refreshLayout();
  }
  else if(!errored) $("#errors").html("&nbsp;");
  
  
  showOrHideOrderbook();
  refreshLayout();
}

function updateSymbol2() {
  var symParts = document.getElementById('symbol2').value.split('.');
  document.getElementById('symbol2').value=symParts[0].toUpperCase()+(symParts.length>1? "."+symParts[1]:"");
  
  symbol2=symParts[0].toUpperCase();
  
  if(symParts.length>1) {
    issuer2 = symParts[1];
    document.getElementById('symbol2').value = symbol2;
  }
  //else issuer2 = "";
  
  if(symbol2!="") {
    if(symbol2 in issuers && issuers[symbol2].length>0 && issuer2=="") {
      if(issuer1!="" && $.inArray(issuer1, issuers[symbol2])>-1) issuer2 = issuer1;
      else issuer2=issuers[symbol2][0];
    }
    else if(!(symbol2 in issuers) && issuer2=="") issuer2 = "[ Enter Address ]";
  }
  
  if(symbol2 in issuers && issuers[symbol2].length==0) issuer2="";
  
  if(issuer2!="") {
    //console.log("issuer2="+issuer2);
    $("#issuer2Label").css("visibility", "visible");
    $("#issuer2").html("<a href='#' onclick='showIssuer2();'>"+(issuer2==address? "You":(issuer2 in issuerNames? issuerNames[issuer2]:issuer2))+"</a>");
  }
  else {
    //console.log("issuer2 hidden");
    $("#issuer2Label").css("visibility", "hidden");
    $("#issuer2").html("");
  }
  
  if(symbol2.length>0 && symbol2.length!=3) {
    $("#errors").html("Symbols must be exactly 3 letters.");
    errored = true;
    refreshLayout();
  }
  
  showOrHideOrderbook();
  refreshLayout();
}

function showOrHideOrderbook() {
  showOrderbook = symbol1!="" && symbol2!="" && symbol1!=symbol2 && (action!="issue" || address!="") && action != "send";
  if(!showOrderbook) $("#orderbook").html("");
}

function refreshLayout() {
  $('#container').css('height', Math.round($(window).height()*.98)+'px');
  
  $('#trade').css('margin-top', Math.round(Math.max(50, ($('#container').height()*.45- $("#topHalf").height() - $("#trade").height())))+'px');
  
  if(action!="send" && $("#issuer2Width").length && Math.abs($("#counterparty").width()-$("#issuer2Width").width())>5) $("#issuer2Width").css("width", Math.round($("#counterparty").width())+"px");
  else if(action=="send" && $("#issuer2Width").length && Math.abs(1.15*$("#recipient").width()-$("#issuer2Width").width())>5) $("#issuer2Width").css("width", Math.round(1.15*$("#recipient").width())+"px");
  
  $('#footer').css('margin-top', Math.round(Math.max(10, (($('#container').height()-$('#content').height()-$('#footer').height()-20))))+'px');
}

function showLogin() {
  $("#accountInput").val(address);
  $("#keyInput").val("");
  $("#disclaimerRead").prop("checked", false);
  $("#disclaimerAgreement").css("border-color", "transparent");
  $("#account").css("border-color", "transparent");
  
  dimBackground();
  $("#login").css("display", "block");
  $("#login").focus();
}

function hideLogin() {
  undimBackground();
  $("#login").css("display", "none");
}

function logout() {
  $("#keyInput").val("");
  $("#accountInput").val("");
  $("#account").val("");
  key="";
  holdings = {};
  holdings[baseCurrency]=0;
  loadAccount();
  hideLogin();
}

function saveLogin() {
  var tempKey = $("#keyInput").val();
  if($("#disclaimerRead").prop("checked")==true) {
    $("#account").val($("#accountInput").val());
    if(tempKey) key = tempKey;
    $("#keyInput").val("");
    $("#keyInput").prop("placeholder", "-- Private Key Hidden --");
    holdings = {};
    holdings[baseCurrency]=0;
    loadAccount();
    hideLogin();
  }
  else $("#disclaimerAgreement").css("border-color", "red");
}

function showPopup(text, header) {
  $("#popupHeader").html(header);
  $("#popupText").html(text);
  dimBackground();
  $("#popup").css("display", "block");
  $("#popup").focus();
}

function hidePopup() {
  undimBackground();
  $("#popup").css("display", "none");
}

function showIssuer1() {
  $("#backerSubmit1").css("display", "inline");
  showIssuer(symbol1, issuer1);
}

function showIssuerYou() {
  showPopup($("#issuerInfo").html(), "What does it mean to issue a symbol?");
}

function showIssuer2() {
  $("#backerSubmit2").css("display", "inline");
  showIssuer(symbol2, issuer2);
}

function showIssuer(symbol, issuer) {
  $("#issuerInput").val(issuer);
  $("#symbolToBeBacked").html(symbol);
  var issuerList = $("#issuerList");
  issuerList.empty();
  issuerList.append($("<option />").val("").text("-- None --"));
  if(symbol in issuers) {
    $.each(issuers[symbol], function() {
        issuerList.append($("<option />").val(this).text((this in issuerNames? issuerNames[this]:this)));
    });
    sortDropDownListByText("issuerList");
    if($.inArray(issuer, issuers[symbol])>-1) issuerList.val(issuer);
  }
  
  dimBackground();
  $("#backer").css("display", "block");
  $("#backer").focus();
}

function sortDropDownListByText(selectId) {
    var foption = $('#'+ selectId + ' option:first');
    var soptions = $('#'+ selectId + ' option:not(:first)').sort(function(a, b) {
       return a.text == b.text ? 0 : a.text < b.text ? -1 : 1
    });
    $('#' + selectId).html(soptions).prepend(foption);              

};

function hideIssuer() {
  undimBackground();
  $("#backer").css("display", "none");
  $("#backerSubmit1").css("display", "none");
  $("#backerSubmit2").css("display", "none");
  updateSymbols();
}

function saveIssuer1() {
  issuer1 = $("#issuerInput").val();
  hideIssuer();
}

function saveIssuer2() {
  issuer2 = ($("#issuerList").val()? $("#issuerList").val():$("#issuerInput").val());
  hideIssuer();
}

function showTrustlines() {
  if(key=="") loginWarning();
  else {
  
    new Promise(function(resolve, reject) { resolve(); }).then(function() {
      if(address=="") return "";
      else {
        var lines = "";
        try {
          noDisconnecting = true;
          $("#errors").html("Loading trustlines...");
          lines = api.getTrustlines(address);
          noDisconnecting = false;
          console.log("Finished loading trustlines...");
        }
        catch(err) {
          console.log("Error getTrustlines: "+err);
          noDisconnecting = false;
        }
        return lines;
      }
    }, function (err) { console.log("Error getTrustlines: "+err); return ""; }).then(function(lines) {
      console.log("Parsing trustlines...");
      trustlines = {};
      if(address!="" && lines) {
        for(var i = 0; i<lines.length; i++) {
          //if(parseFloat(lines[i].specification.limit)==0) continue;
          if(!(lines[i].specification.currency in trustlines)) trustlines[lines[i].specification.currency] = {};
          trustlines[lines[i].specification.currency][lines[i].specification.counterparty] = parseFloat(lines[i].specification.limit);
        }
      }
      /*
      try {
        if(address!="" && key!="" && Object.keys(holdings).length==1 && Object.keys(trustlines).length==0 && holdings[baseCurrency]>minBaseCurrency) defaultTrustlines(0);
      }
      catch(err) {
        console.log("Error defaultTrustlines(0): "+err);
      }*/
      
      }, function(er) { console.log("Error compiling trustlines: "+er); }).then(function(lines) {
      
        console.log("Building trustlines table...");
        $("#trustlinesTable").find("tr:gt(0)").remove();
        var symbols = [];
        for(var symbol in trustlines)
          if($.inArray(symbol, symbols) === -1) symbols.push(symbol);
        symbols.sort();
        
        var n = 0;
        for(var i=0; i<symbols.length; i++) {
          var backers = [];
          for(var backer in trustlines[symbols[i]])
            if($.inArray(backer, backers) === -1) backers.push(backer);
          backers.sort(function(a,b) {
              return  (a in issuerNames? issuerNames[a]:a) - (b in issuerNames? issuerNames[b]:b);
          });
          for(var j=0; j<backers.length; j++) {
            if(trustlines[symbols[i]][backers[j]]>=0) {
              $('#trustlinesTable').append("<tr><td id='trustSymbol"+n+"' class='trustSymbol'><div><input type='text' readonly='readonly' id='trustedSymbol"+n+"' name='trustedSymbol"+n+"' value='"+symbols[i]+"' style='opacity:.6;'  /></div></td><td id='trustIssuer"+n+"' class='trustIssuer'><div><input type='text' readonly='readonly' id='trustedIssuer"+n+"' name='trustedIssuer"+n+"' value='"+backers[j]+"' style='opacity:.6;' /></div></td><td id='trustLimit"+n+"' class='trustLimit'><div><input type='number' id='limit"+n+"' name='limit"+n+"' value='"+trustlines[symbols[i]][backers[j]]+"' /></div></td><td id='trustDelete"+n+"' class='trustDelete'><div><a href='#' onclick='$(\"#limit"+n+"\").val(0);'>[X]</a></div></td></tr>");
              replaceTrustedAddressWithName("trustIssuer"+n, "trustedIssuer"+n, backers[j]);
            }
            n++;
          }
        }
        console.log("Finished trustlines table...");
        dimBackground();
        $("#trustlines").css("display", "block");
        $("#trustlines").focus();
        $("#errors").html("&nbsp;");
     }, function(err) { console.log("Error loading trustlines: "+err); });
  }
}

function replaceTrustedAddressWithName(container, id, address) {
  if(address in issuerNames) {
    $("#"+container).html("<div><input type='hidden' id='"+id+"' name='"+id+"' value='"+address+"' /><input type='text' id='display"+id+"' readonly='readonly' name='display"+id+"' value='"+issuerNames[address]+"' style='opacity:.6;' /></div>");
    $("#display"+id).on("click", function() {
        replaceTrustedNameWithAddress(container, id, address);
    });
  }
}

function replaceTrustedNameWithAddress(container, id, address) {
  $("#"+container).html("<div><input type='text' id='"+id+"' readonly='readonly' name='"+id+"' placeholder='Issuer Address...' value='"+address+"' style='opacity:.6;' /></div>");
  $("#"+id).on("click", function() {
      replaceTrustedAddressWithName(container, id, address);
  });
}

function addTrustline() {
  var n = $('#trustlinesTable tr').length-1;
  $('#trustlinesTable tr:last').after("<tr><td  id='trustSymbol"+n+"' class='trustSymbol'><input type='text' id='trustedSymbol"+n+"' name='trustedSymbol"+n+"' placeholder='Symbol Name...' value='' /></td><td id='trustIssuer"+n+"' class='trustIssuer'><input type='text' id='trustedIssuer"+n+"' name='trustedIssuer"+n+"' placeholder='Issuer Address...' value='' /></td><td id='trustLimit"+n+"' class='trustLimit'><input type='number' id='limit"+n+"' name='limit"+n+"' value='0' /></td></tr>");
  $('#trustlinesBox').scrollTop($('#trustlinesBox')[0].scrollHeight);
  $("#trustedSymbol"+n).on("change", function (e) {
    var temp = $("#trustedSymbol"+n).val().toUpperCase();
    $("#trustedSymbol"+n).val(temp);
    var existingIssuer = $("#trustedIssuer"+n).val();
    if(temp.length>0) {
      if(temp in issuers) {
        var selectMenu = "<select id='trustedIssuer"+n+"' name='trustedIssuer"+n+"'>";
        for(var i=0; i<issuers[temp].length; i++)
          selectMenu+="<option value='"+issuers[temp][i]+"'>"+(issuers[temp][i] in issuerNames? issuerNames[issuers[temp][i]]:issuers[temp][i])+"</option>";
        selectMenu+="</select>";
        $("#trustIssuer"+n).html(selectMenu);
        sortDropDownListByText("trustedIssuer"+n);
        $("#trustedIssuer"+n).val(existingIssuer==""? issuers[temp][0]:existingIssuer);
        $("#trustedIssuer"+n).append($("<option />").val("-").text("-- Enter Address Manually --"));
        $("#trustedIssuer"+n).on("change", function() {
          if($("#trustedIssuer"+n).val()=="-")
            $("#trustIssuer"+n).html("<input type='text' id='trustedIssuer"+n+"' name='trustedIssuer"+n+"' placeholder='Issuer Address...' value='' />");
        });
      }
      else $("#trustIssuer"+n).html("<input type='text' id='trustedIssuer"+n+"' name='trustedIssuer"+n+"' placeholder='Issuer Address...' value='"+existingIssuer+"' />");
    }
  });
}

function saveTrustlines() {
  hideTrustlines();
  $("#errors").html("&nbsp;");
  showPopup("Updating settings...", "Updating What Others Can Send You...");
  
  var n = $('#trustlinesTable tr').length-1;
  var updates = false;
  var symbol = "";
  var issuer = "";
  var limit = 0;
  var ix = 0;
  for(var i=0; i<n; i++) {
    symbol = $("#trustedSymbol"+i).val();
    issuer = $("#trustedIssuer"+i).val();
    try {
    limit = parseFloat($("#limit"+i).val());
    }
    catch(ex) { limit = 0; }
    ix = i;
    if(!(symbol in trustlines) || !(issuer in trustlines[symbol]) || limit!=trustlines[symbol][issuer]) {
      updates = true;
      break;
    }
  }
  if(updates) updateTrustline(issuer, symbol, limit, ix, n);
  else $("#popupText").append("<br />No updates to what other people can send you.");
}

function hideTrustlines() {
  undimBackground();
  $("#trustlines").css("display", "none");
}

function defaultTrustlines(itemToSubmit) {
  return;
  if(address!="" && key!="") {
    console.log("Setting default trustlines for new account...");
    var n = 0;
    for(var symbol in majorIssuers) {
      for(var i = 0; i < majorIssuers[symbol].length; i++) {
        
        if(n==itemToSubmit && majorIssuers[symbol][i]!="undefined" && (!(symbol in trustlines) || !(majorIssuers[symbol][i] in trustlines[symbol]))) {
          
          var qty = 9999999999;
          
          var line = {currency:symbol, counterparty:majorIssuers[symbol][i], limit:""+qty, ripplingDisabled:true};
          
          var options = {};
          options.maxFee = maxFee;
          options.maxLedgerVersionOffset = maxLedgerOffset;
          noDisconnecting = true;
          api.prepareTrustline(address, line, options).then(function(prepared)
          {
              var transaction = "";
              var transactionID = -1;
              try {
                var result = api.sign(prepared.txJSON, key);
                transaction = result.signedTransaction;
                transactionID = result.id;
              }
              catch(er) {
                console.log("Error setting default trustline: "+er);
              }
              
              if(transaction!="") {
                console.log("Adding trust for "+symbol+" by "+majorIssuers[symbol][i]+"...");
                api.submit(transaction).then(function(result) {
                  //loadAccount();
                  
                  if(result.resultCode=="tesSUCCESS")
                   { }
                  else {
                    console.log("Error setting default trustline for "+symbol+" by "+majorIssuers[symbol][i]+": "+result.resultMessage);
                  }
                }, function (err) {
                  console.log("Error setting default trustline for "+symbol+" by "+majorIssuers[symbol][i]+": "+err);
                }).then(function() {
                  noDisconnecting = false;
                  defaultTrustlines(itemToSubmit+1);
                }, function(err) { console.log("Error defaultTrustlines: "+err); noDisconnecting = false; });
              }
              else noDisconnecting = false;
          });
        }
        
        n++;
      }
    }
  }
}

function updateTrustline(issuer, symbol, qty, i, n) {
  if(address!="" && key!="") {
    var line = {currency:symbol, counterparty:issuer, limit:""+qty, ripplingDisabled:true};
    
    var backer = issuer;
    if(backer in issuerNames) backer = issuerNames[backer];
    var options = {};
    options.maxFee = maxFee;
    options.maxLedgerVersionOffset = maxLedgerOffset;
    noDisconnecting = true;
    api.prepareTrustline(address, line, options).then(function(prepared)
    {
        var transaction = "";
        var transactionID = -1;
        try {
          var result = api.sign(prepared.txJSON, key);
          transaction = result.signedTransaction;
          transactionID = result.id;
        }
        catch(er) {
          $("#popupText").append("<br />Error signing update for "+symbol+" by "+backer+": "+er);
        }
        
        if(transaction!="") {
          api.submit(transaction).then(function(result) {
            //loadAccount();
            noDisconnecting = false;
            
            if(result.resultCode=="tesSUCCESS")
             $("#popupText").append("<br />Update for "+symbol+" by "+backer+" successfully completed.");
            else $("#popupText").append("<br />Update Result for "+symbol+" by "+backer+": "+result.resultMessage);
          }, function (err) {
            $("#popupText").append("<br />Error updating for "+symbol+" by "+backer+": "+err);
          }).then(function() {
            i++;
            if(i<n) {
              var sy = $("#trustedSymbol"+i).val();
              var is = $("#trustedIssuer"+i).val();
              var li = parseFloat($("#limit"+i).val());
              updateTrustline(is, sy, li, i, n);
            }
            else $("#popupText").append("<br />All updates complete.");
          });
        }
        else noDisconnecting = false;
    }, function (er) {
        $("#popupText").append("<br />Error preparing update for "+symbol+" by "+backer+": "+err);
        noDisconnecting = false;
    });
  }
  else {
    loginWarning();
    $("#popupText").append("<br />Invalid account address and private key combination.");
  }
}

function showDestinationTag() {
  dimBackground();
  $("#destinationTagInput").val(destTag);
  $("#destinationTagWindow").css("display", "block");
  $("#destinationTagWindow").focus();
}

function hideDestinationTag() {
    undimBackground();
    $("#destinationTagWindow").css("display", "none");
}


function saveDestinationTag() {
    if($("#destinationTagInput").val()!="") {
      destTag = parseInt($("#destinationTagInput").val());
      $("#currentDestinationTag").html(": "+destTag);
    }
    else {
      destTag = "";
      $("#currentDestinationTag").html("");
    }
    
    hideDestinationTag();
}

function cancelDestinationTag() {
    hideDestinationTag();
}

function loginWarning() {
  errored=true; 
  $("#errors").html("You must <a href='#' onclick='showLogin();'>Login</a> with your private key first to do that.");
  refreshLayout();
  $("#account").css("border-color", "red");
}

function cancelOrder(seq) {
  if(address!="" && key!="") {
    if($.isNumeric(seq)) {
      var order = {orderSequence:seq};
      var options = {};
      options.maxFee = maxFee;
      options.maxLedgerVersionOffset = maxLedgerOffset;
      noDisconnecting = true;
      api.prepareOrderCancellation(address, order, options).then(function(prepared)
      {
          $("#errors").html("Submitting order cancellation... Please wait...");
          
          var transaction = "";
          var transactionID = -1;
          try {
            var result = api.sign(prepared.txJSON, key);
            transaction = result.signedTransaction;
            transactionID = result.id;
          }
          catch(er) {
            $("#errors").html("Error signing order to cancel: "+er);
            errored = true;
            refreshLayout();
          }
          
          if(transaction!="") {
            api.submit(transaction).then(function(result) {
              if(result.resultCode=="tesSUCCESS")
                $("#errors").html("Order cancellation submitted.");
              else $("#errors").html("Cancellation submitted with result: "+result.resultMessage);
              errored = true;
              //loadAccount();
              noDisconnecting = false;
              refreshLayout();
            }, function (err) {
              $("#errors").html("Error cancelling order: "+err);
              errored = true;
              noDisconnecting = false;
              refreshLayout();
            });
          }
          else noDisconnecting = false;
      }, function (er) {
          $("#errors").html("Error preparing to cancel order: "+err);
          errored = true;
          noDisconnecting = false;
          refreshLayout();
      });
    }
  }
  else {
    loginWarning();
  }
}

function aboutReceivables() {
  showPopup(""+$("#trustlinesInfo").html(), "Sending and Receiving...");
}

function submitTransaction() {
  if(!address || !key) {
    loginWarning();
  }
  else if(holdings[baseCurrency] < minBaseCurrency) {
    checkMinBaseCurrency();
  }
  else {
    errored = false;
    $("#errors").html("&nbsp;");
    var trans = action;
    if(trans=="issue") trans = "sell";
    if(trans=="send") {
        updateSymbol1();
        var qty = parseFloat($("#qty1").val());
        var recipient = $("#recipient").val();
        if(qty<=0 || !$.isNumeric(qty)) {
          $("#errors").html("Please specify qty above 0.");
          errored = true;
          refreshLayout();
        }
        else if(!symbol1) {
          $("#errors").html("Please input a valid symbol.");
          errored = true;
          refreshLayout();
        }
        else if(symbol1.length!=3) {
          $("#errors").html("Symbols must be exactly 3 letters.");
          errored = true;
          refreshLayout();
        }
        else if(!issuer1 && !(symbol1 in issuers && issuers[symbol1].length==0)) {
          $("#errors").html("Please specify issuer's address for the symbol in the format Symbol.Issuer");
          errored = true;
          refreshLayout();
        }
        else if(!recipient) {
          $("#errors").html("Please specify recipient address.");
          errored = true;
          refreshLayout();
        }
        else {
          var trusted = false;
          new Promise(function(resolve, reject) { 
          if(symbol1==baseCurrency) {
            trusted = true;
            resolve();
          }
          else {
            try {
              noDisconnecting = true;
              api.getTrustlines(recipient, {counterparty:issuer1, currency:symbol1}).then(function(lines) {
                noDisconnecting = false;
                if(lines) {
                  console.log(lines);
                  for(var i = 0; i<lines.length; i++) {
                    if(lines[i].specification.currency==symbol1 && lines[i].specification.counterparty==issuer1 && parseFloat(lines[i].specification.limit)>=qty) {
                    trusted = true;
                    console.log("Found.");
                    break;
                    }
                  }
                  resolve();
                }
              });
            }
            catch (er) { noDisconnecting = false; }
          }
          }).then(function() {
            if(!trusted && issuer1!=recipient) {
              $("#errors").html("Error: Recipient does not accept "+symbol1+" issued by "+(issuer1 in issuerNames? issuerNames[issuer1]:issuer1)+". Ask Recipient to <a href='#' onclick='aboutReceivables();'>Set What Others Can Send [Them]</a>.");
              errored = true;
              refreshLayout();
            }
            else {
              var payment = {};
              payment.source = {};
              payment.source.address = address;
              payment.source.maxAmount = {};
              payment.source.maxAmount.value = ""+qty;
              payment.source.maxAmount.currency = symbol1;
              if(issuer1!="" && (!(symbol1 in issuers) || $.inArray(issuer1, issuers[symbol1])>-1))
                payment.source.maxAmount.counterparty = issuer1;
              
              payment.destination = {};
              payment.destination.address = recipient;
              payment.destination.amount = {};
              payment.destination.amount.value = ""+qty;
              payment.destination.amount.currency = symbol1;
              if(symbol1!=baseCurrency && issuer1!="" && (!(symbol1 in issuers) || $.inArray(issuer1, issuers[symbol1])>-1))
                payment.destination.amount.counterparty = issuer1;
              if(destTag!="")
                payment.destination.tag = destTag;
                
              if(symbol1!=baseCurrency) payment.allowPartialPayment = true;
              
              try {
                console.log(payment);
                var options = {};
                options.maxFee = maxFee;
                options.maxLedgerVersionOffset = maxLedgerOffset;
                noDisconnecting = true;
                api.preparePayment(address, payment, options).then(function(prepared)
                  {
                    $("#errors").html("Submitting send transaction... Please wait...");
                  
                    var transaction = "";
                    var transactionID = -1;
                    try {
                      var result = api.sign(prepared.txJSON, key);
                      transaction = result.signedTransaction;
                      console.log(transaction);
                      transactionID = result.id;
                    }
                    catch(er) {
                      $("#errors").html("Error signing transaction to send: "+er);
                      errored = true;
                      refreshLayout();
                    }
                    
                    if(transaction!="") {
                      api.submit(transaction).then(function(result) {
                        if(result.resultCode=="tesSUCCESS")
                          $("#errors").html(qty+" "+$("#symbol1").val()+" <a href='https://charts.ripple.com/#/transactions/"+transactionID+"' target='_blank'>sent to "+recipient+(destTag==""? "":" (Destination Tag "+destTag+")")+"</a>!");
                        else $("#errors").html("Submitted with result: "+result.resultMessage+" <a href='https://charts.ripple.com/#/transactions/"+transactionID+"' target='_blank'>See Details...</a><br />Check <a href='https://bithomp.com/explorer/"+address+"' target='_blank'>Account History</a> to confirm successful transaction.");
                        errored = true;
                        //loadAccount();
                        noDisconnecting = false;
                        refreshLayout();
                      }, function (err) {
                        $("#errors").html("Error sending to recipient: "+err);
                        errored = true;
                        noDisconnecting = false;
                        refreshLayout();
                      });
                    }
                    else noDisconnecting = false;
                }, function (er) {
                    $("#errors").html("Error preparing to send: "+err);
                    errored = true;
                    noDisconnecting = false;
                    refreshLayout();
                });
              }
              catch(ex) {
                $("#errors").html("Error sending: "+ex);
                errored = true;
                refreshLayout();
              }
            }
          });
        }
      }
      else if(trans=="buy" || trans=="sell") {
        updateSymbols();
        var qty1 = parseFloat($("#qty1").val());
        var price = parseFloat($("#price").val());
        if(qty1<=0 || !$.isNumeric(qty1)) {
          $("#errors").html("Please specify qty above 0.");
          errored = true;
          refreshLayout();
        }
        else if(!symbol1) {
          $("#errors").html("Please input a valid symbol.");
          errored = true;
          refreshLayout();
        }
        else if(!issuer1 && !(symbol1 in issuers && issuers[symbol1].length==0)) {
          $("#errors").html("Please specify issuer's address for "+symbol2+" in the format Symbol.Issuer");
          errored = true;
          refreshLayout();
        }
        else if(price<=0 || !$.isNumeric(price)) {
          $("#errors").html("Please specify price above 0.");
          errored = true;
          refreshLayout();
        }
        else if(!symbol2) {
          $("#errors").html("Please input a valid symbol.");
          errored = true;
          refreshLayout();
        }
        else if(!issuer2 && !(symbol2 in issuers && issuers[symbol2].length==0)) {
          $("#errors").html("Please specify issuer's address for "+symbol2+" in the format Symbol.Issuer");
          errored = true;
          refreshLayout();
        }
        else if(symbol1.length!=3 || symbol2.length!=3) {
          $("#errors").html("Symbols must be exactly 3 letters.");
          errored = true;
          refreshLayout();
        }
        else if(symbol1!="" && action=="issue" && issuer1=="" && address!="") {
          $("#errors").html("Invalid symbol to issue. Choose a different name to issue your own symbol.");
          errored = true;
        }
        else {
          $("#errors").html("Submitting order request to "+action+" "+qty1+" "+symbol1+"... Please wait...");
        
          var order = {};
          order.direction = trans;
          
          order.quantity = {};
          order.quantity.currency = symbol1;
          order.quantity.value = ""+qty1;
          if(issuer1!="" && (!(symbol1 in issuers) || $.inArray(issuer1, issuers[symbol1])>-1))
            order.quantity.counterparty = issuer1;
        
          order.totalPrice = {};
          order.totalPrice.currency = symbol2;
          order.totalPrice.value = ""+(Math.round(price*qty1 * 1000000)/1000000);
          if(issuer2!="" && symbol2!=baseCurrency && (!(symbol2 in issuers) || $.inArray(issuer2, issuers[symbol2])>-1))
            order.totalPrice.counterparty = issuer2;

          try {
            console.log(order);
            var options = {};
            options.maxFee = maxFee;
            options.maxLedgerVersionOffset = maxLedgerOffset;
            noDisconnecting = true;
            api.prepareOrder(address, order, options).then(function(prepared)
              {
                
                var transaction = "";
                var transactionID = -1;
                try {
                  var result = api.sign(prepared.txJSON, key);
                  transaction = result.signedTransaction;
                  console.log(transaction);
                  transactionID = result.id;
                }
                catch(er) {
                  $("#errors").html("Error signing transaction to "+action+": "+er);
                  errored = true;
                  refreshLayout();
                }
                
                
                if(transaction!="") {
                  api.submit(transaction).then(function(result) {
                    var issueInfo = "";
                    if(action=="issue") issueInfo = "<br /><br />Share the below link to let others trade your newly issued "+symbol1+":<br /><input type='text' value='https://www.theworldexchange.net/?symbol1="+symbol1+"."+address+"&amp;symbol2="+symbol2+"."+issuer2+"' onclick='this.select();' readonly='readonly' class='linkShare' />";
                    if(result.resultCode=="tesSUCCESS")
                      $("#errors").html("Order submitted to "+action+" "+qty1+" "+symbol1+"! <a href='https://charts.ripple.com/#/transactions/"+transactionID+"' target='_blank'>See Transaction Details...</a>"+issueInfo);
                    else $("#errors").html("Submitted with response: "+result.resultMessage+".<br /><a href='https://charts.ripple.com/#/transactions/"+transactionID+"' target='_blank'>Check Transaction Details</a> after a few minutes to confirm if successful."+issueInfo);
                    errored = true;
                    //loadAccount();
                    noDisconnecting = false;
                    refreshLayout();
                  }, function (err) {
                    $("#errors").html("Error in "+action+" submission: "+err);
                    errored = true;
                    noDisconnecting = false;
                    //loadAccount();
                    refreshLayout();
                  });
                }
                else noDisconnecting = false;
            }, function (er) {
                $("#errors").html("Error preparing to send: "+err);
                errored = true;
                noDisconnecting = false;
                refreshLayout();
            });
          }
          catch(ex) {
            $("#errors").html("Error "+action+"ing: "+ex);
            errored = true;
            refreshLayout();
          }
        }
    }
  }
}


function dimBackground() {
  $("body").css("overflow", "hidden");
  $("#loginBackground").css("display", "block");
  errored = false;
  $("#errors").html("&nbsp;");
}

function undimBackground() {
  $("body").css("overflow", "auto");
  $("#loginBackground").css("display", "none");
  errored = false;
  $("#errors").html("&nbsp;");
}

function createAccount() {
  try {
    noDisconnecting = true;
    var newAccount = api.generateAddress();
    $("#accountInput").val(newAccount.address);
    $("#keyInput").val(newAccount.secret);
    $("#newAccountField").html("New account details above.<br />Save them before logging in!");
    noDisconnecting = false;
  }
  catch (ex) {
    $("#newAccountField").html("Error creating account:<br /><small>"+ex+"</small>");
  }
}

function loadURLPrice(price) {
  new Promise(function(resolve, reject) {
    resolve();
  }).then(function() {
    $("#price").val(parseFloat(parseFloat(price).toFixed(accuracy)));
  }).then(function() {
      updateAction();
  }).then(function() {
    updateSymbols();
  }).then(function () {
    updateURL();
  });
}

function loadURLSymbol(action, qty1, symbol1) {
  new Promise(function(resolve, reject) {
    resolve();
  }).then(function() {
    if(action!="") $("#action").val(action);
    $("#qty1").val(parseFloat(parseFloat(qty1).toFixed(accuracy)));
    var symParts = symbol1.split('.');
    if(symParts.length>1) issuer1 = symParts[1];
    else issuer1 = "";
    $("#symbol1").val(symParts[0]);
  }).then(function() {
      if(action!="") updateAction();
  }).then(function() {
    updateSymbols();
  }).then(function () {
    updateURL();
  });
}

function loadURLSymbols(action, qty1, symbol1, price, symbol2) {
  new Promise(function(resolve, reject) {
      resolve();
    }).then(function() {
      if(action!="") $("#action").val(action);
      $("#qty1").val(parseFloat(parseFloat(qty1).toFixed(accuracy)));
      $("#price").val(parseFloat(parseFloat(price).toFixed(accuracy)));
      $("#symbol1").val(symbol1);
      $("#symbol2").val(symbol2);
  }).then(function() {
      if(action!="") updateAction();
  }).then(function() {
    updateSymbols();
  }).then(function () {
    updateURL();
  });
}

function loadURLSend(action, qty1, symbol1, recipient) {
  new Promise(function(resolve, reject) {
      resolve();
    }).then(function() {
      $("#action").val(action);
      $("#qty1").val(parseFloat(parseFloat(qty).toFixed(accuracy)));
      var symParts = symbol1.split('.');
      if(symParts.length>1) issuer1 = symParts[1];
      else issuer1 = "";
      $("#recipient").val(recipient);
  }).then(function() {
      updateAction();
  }).then(function() {
    updateSymbols();
  }).then(function () {
    updateURL();
  });
}

function marquee(a, b) {
  var width = b.width();
  var start_pos = a.width();
  var end_pos = -width;

  function scroll() {
      if (b.position().left <= -width) {
          b.css('left', start_pos);
          scroll();
      }
      else {
          time = (parseInt(b.position().left, 10) - end_pos) *
              (10000 / (start_pos - end_pos));
          b.animate({
              'left': -width
          }, time, 'linear', function() {
              scroll();
          });
      }
  }

  b.css({
      'width': width,
      'left': start_pos
  });
  scroll(a, b);
  b.mouseenter(function() {   
      b.stop();                 
      b.clearQueue();           
  });                           
  b.mouseleave(function() {     
      scroll(a, b);            
  });                           
}

$(document).ready(function() {
    
    $( window ).on( "orientationchange", function( ) {
			refreshLayout();
		});
    window.onresize = refreshLayout;
    
    $("#errors").html("&nbsp;");
    refreshLayout();
 
      $('#form').on('submit', function(e) {
        e.preventDefault();  //prevent form from submitting
        return false;
    });
    
    $('#action').change(function() {updateAction(); updateURL(); });
    updateAction();
    
    $('#symbol1').change(function() {errored = false; $("#errors").html("&nbsp;"); issuer1 = ""; updateSymbol1(); updateURL(); });
    $('#symbol2').change(function() {errored = false; $("#errors").html("&nbsp;"); issuer2 = ""; updateSymbol2(); updateURL();  });
    $('#qty1').change(function() { updateURL();  });
    $('#price').change(function() { updateURL();  });
    $('#recipient').change(function() { updateURL();  });
    
    $("#accountInput").keypress(function (e) {if (e.which == 13) { saveLogin(); return false; }});
    $("#keyInput").keypress(function (e) {if (e.which == 13) { saveLogin(); return false; }});
    $("#loginSubmit").on("click", function() { saveLogin(); });
    $("#logoutSubmit").on("click", function() { logout(); });
    $("#newAccountSubmit").on("click", function() { createAccount(); });
    $("#cancelLogin").on("click", function() { if(address!="" || $("#addressInput").val()=="" || $("#keyInput").val()=="") hideLogin(); });
    $("#submit").on("click", function() { submitTransaction(); });
    $("#account").on("click", function() { showLogin(); });
    
    hideIssuer();
    document.getElementById('issuerList').onchange = function() { $("#issuerInput").val($("#issuerList").val()); };
    $("#cancelBacker").on("click", function() { hideIssuer(); });
    $("#backerSubmit1").on("click", function() { saveIssuer1(); updateURL(); });
    $("#backerSubmit2").on("click", function() { saveIssuer2(); updateURL(); });
    
    $("#submitNewTrust").on("click", function() { addTrustline(); });
    $("#cancelTrust").on("click", function() { hideTrustlines(); });
    $("#submitTrust").on("click", function() { saveTrustlines(); });
    
    $("#destinationTagSubmit").on("click", function() { saveDestinationTag(); updateURL(); });
    $("#destinationTagCancel").on("click", function() { cancelDestinationTag(); });
    
    $("#okPopup").on("click", function() { hidePopup(); });
    
    /*$("#symbol1").keypress(function (e) { if (e.which == 13) { errored = false; $("#errors").html("&nbsp;"); updateSymbols(); return false; }});
    $("#symbol2").keypress(function (e) { if (e.which == 13) { errored = false; $("#errors").html("&nbsp;"); updateSymbols();  return false; }});
    $("#qty1").keypress(function (e) {   if (e.which == 13) { errored = false; $("#errors").html("&nbsp;"); return false; } });
    $("#price").keypress(function (e) { if (e.which == 13) { errored = false; $("#errors").html("&nbsp;"); return false; }  });
    $("#recipient").keypress(function (e) { if (e.which == 13) { errored = false; $("#errors").html("&nbsp;"); return false; }  });*/
    
    $("#account").val(Cookies.get('accountAddr'));
    address = $("#account").val();
    updateLoginMessage();
    
    
    $("#scrollingText").smoothDivScroll({
      autoScrollingMode: "always",
      autoScrollingDirection: "endlessLoopRight",
      autoScrollingStep: 1,
      autoScrollingInterval: 15 
    });
    
    $("#scrollingText").bind("mouseover", function(){
      $("#scrollingText").smoothDivScroll("stopAutoScrolling");
    });
    
    $("#scrollingText").bind("mouseout", function(){
      $("#scrollingText").smoothDivScroll("startAutoScrolling");
    });
    
    var hashTag = window.location.hash;

    if (hashTag === "#about" || hashTag=="#instant" || hashTag=="#represent" || hashTag=="#global" || hashTag=="#started" || hashTag=="#works" || hashTag=="#reading") {
      $("#about").css("display", "block");
      jQuery("html,body").animate({scrollTop: jQuery(hashTag).offset().top}, 1000);
    }
    
    $("#errors").html("Connecting... Please wait...");
    refreshLayout();
    
    try {
      api.connect().then(function() {
          return api.getServerInfo();
      }).then( function(info) {
        if(info && info.validatedLedger) {
          baseReserve = parseFloat(info.validatedLedger.reserveBaseXRP);
          baseIncrement = parseFloat(info.validatedLedger.reserveIncrementXRP);
          baseFee = parseFloat(info.validatedLedger.baseFeeXRP);
        }
      }).then(function() {
         updateSymbols();
         refreshLayout();
         loadOrderbook(); 
      }, function(err) { 
        console.log("Error starting orderbook: "+err);
        console.log("Retrying start orderbook...");
        loadOrderbook(); 
      }).then(function() {
          $.get( dataAPI+"/v2/gateways/", function( data ) {
            for(var symbol in data) {
              if(symbol.length>10) continue;
              if(!(symbol in issuers)) issuers[symbol] = [];
              for(var i = 0; i<data[symbol].length; i++) {
                if($.inArray(data[symbol][i].account, issuers[symbol])===-1)
                  issuers[symbol][issuers[symbol].length] = data[symbol][i].account;
                if(!(data[symbol][i].account in issuerNames)) issuerNames[data[symbol][i].account] = data[symbol][i].name;
              }
            }
            
            var symbolsList = symbolLister();
            $("#symbol1").autocomplete({ source:symbolsList, minLength:0, select: function(event, ui) { document.getElementById('symbol1').value = ui.item.value; errored = false; $("#errors").html("&nbsp;"); issuer1 = ""; updateSymbol1(); updateURL(); }}).focus(function() {$(this).autocomplete('search', $(this).val())});
            $("#symbol2").autocomplete({ source:symbolsList, minLength:0, select: function(event, ui) { document.getElementById('symbol2').value = ui.item.value; errored = false; $("#errors").html("&nbsp;"); issuer2 = ""; updateSymbol2(); updateURL(); }}).focus(function() {$(this).autocomplete('search', $(this).val())});
            
          }, "json" );
          
          $("#errors").html("&nbsp;");
          
          $(window).scroll(function() {
            if($("#about").css("display")=="block") {
               var wS = $(this).scrollTop();
               if (numIntervals>=0 && wS == 0){
                 $("#about").css("display", "none");
                 setURL("");
               }
             }

          });
          
          $(window).on('mousewheel DOMMouseScroll', function(event){
            if (event.originalEvent.wheelDelta < 0 || event.originalEvent.detail > 0) {
              if($("#about").css("display")=="none" && $(window).scrollTop() + $(window).height() >= $(document).height()) {
                $("#about").css("display", "block");
                jQuery("html,body").animate({scrollTop: jQuery("#about").offset().top}, 1000);
                setURL("#about");
              }
            }
          });
          
          $(window).on('touchstart', function(e) {

              var swipe = e.originalEvent.touches,
              start = swipe[0].pageY;

              $(this).on('touchmove', function(e) {

                  var contact = e.originalEvent.touches,
                  end = contact[0].pageY,
                  distance = end-start;

                  if (distance < -30) {
                    if($("#about").css("display")=="none" && $(window).scrollTop() + $(window).height() >= $(document).height()) {
                      $("#about").css("display", "block");
                      jQuery("html,body").animate({scrollTop: jQuery("#about").offset().top}, 1000);
                      setURL("#about");
                    }
                  }
              })
              .one('touchend', function() {

                  $(this).off('touchmove touchend');
              });
          });
          
          $(window).on('touchmove',function(){
            
          });
      });
    }
    catch(er) {
      console.log("API Error: "+er);
    }
    
    api.on('error', (errorCode, errorMessage) => {
      console.log("Error: "+errorCode + ': ' + errorMessage);
    });
    api.on('connected', () => {
      console.log('Connected.');
    });
    api.on('disconnected', (code) => {
      // code - [close code](https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent) sent by the server
      // will be 1000 if this was normal closure
      if(!reconnecting) {
      console.log('Disconnected, code:', code);
        try {
          reconnecting = true;
          api.connect().then(function() {
          console.log("Reconnected async.");
          reconnecting = false;
          }, function (err) { 
          console.log("Failed to reconnect async: "+err);
          reconnecting = false;
          });
        }
        catch (er) {
          console.log("Failed to reconnect async: "+er);
          reconnecting = false;
        }
      }
    });
    
});