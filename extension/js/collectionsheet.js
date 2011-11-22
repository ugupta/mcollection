var customerId;
var collectionData;
var currentCenter;
var personnel;
var placeHolder;
var center;
var groups = [];
var clients = [];
var date;
var CENTER_LEVEL = 3;
var GROUP_LEVEL = 2;
var CLIENT_LEVEL = 1;
var debug = true;
var connectionStatus;
var prevConnectionStatus;
var statusIntervalReference;
var statusInterval = 1000;
var forceLogin = true;

function reset() {
    logoutAjax();
    window.localStorage.clear();
    window.location.reload();
}

function init() {
    placeHolder = $("#placeholder");
    currentCenter = getItem('currentCenter');
    if (currentCenter == null) {
        placeHolder.html("Welcome to Mifos offline collectionsheet - Google Chrome Extension");
        createCenterList();
    } else {
        createCenterList();
        loadCollectionSheetUI();
    }
    statusIntervalReference = setInterval("startStatusTrack()", statusInterval);
    addDebugTools();
}

function addDebugTools() {
     var htmlStr = "";
     if(debug == true) {
        htmlStr += "<input type=button onclick='reset()' value='Reset' />"
                 + "<input type=button onclick='listAllItems()' value='Show Local Storage' />";
       $("#debugTools").html(htmlStr);
    }
}

function startStatusTrack() {
    var htmlStr = "No Connection";
    var ele = $("#status");
    ele.attr('class','redStatus');
    createLoginDialog();
    loginAjax(loginSuccess);
    if(connectionStatus == 'Success') {
       htmlStr = "Ready to Sync/Submit";
       ele.attr('class','greenStatus');
       if(personnel == null) {
           afterLoginSuccess();
       }
       
       htmlStr += "<input type=button onclick='submitCollectionsheet()' value='Submit Currently Displayed Collectionsheet' />";

    } else if(connectionStatus == 'session expired') {
       htmlStr = "Login please";
       ele.attr('class','yellowStatus');
    } 

    $("#status").html(htmlStr)
}

function createLoginDialog() {
    var username = getItem('username');
    var password = getItem('password');
    var baseURL = getItem('baseURL');
    if(username == undefined) {
       username = "loanoffice";
       setItem('username', username);
    }
    if(password == undefined) {
        password = "testmifos";
        setItem('password', password);
    }
    if(baseURL == undefined) {
        baseURL = "http://localhost:8083/mifos/";
        setItem('baseURL', baseURL);
    }
    var htmlStr = "";

    // has connection status changed
    if(forceLogin || prevConnectionStatus !== connectionStatus) {
        prevConnectionStatus = connectionStatus
	    if(connectionStatus == undefined) {
		htmlStr += "<input type='text' id='url' name='url' size=40 value='"+baseURL+"'></input>\n"
		         + "<input type='button' id='loginButton' value='Submit'></input>\n";
	    } else if(connectionStatus == 'session expired') {
		htmlStr += "<input type='text' id='url' name='url' size=40 value='"+baseURL+"'></input>\n"
                 + "<input type='text' id='username' name='url' placeholder='username' value='"+username+"'></input>\n" 
		         + "<input type='password' id='password' name='url' placeholder='password' value='"+password+"' ></input>\n"
		         + "<input type='button' id='loginButton' value='Submit'></input>\n";
	    } 
	    $("#loginDialog").html(htmlStr);
	    $("#loginButton").click(getLoginParameters);
   }
    if(forceLogin) {
       forceLogin = false;
    }
}

function getLoginParameters() {
    var username = $("#username").val();
    var password = $("#password").val();
    var baseURL = $("#url").val();
    $("#loginDialog").html("<img src='images/loader.gif' />");
    setItem('username', username);
    setItem('password', password);
    setItem('baseURL', baseURL);
    forceLogin = true;
}

function loginAjax(callback) {
    var username = getItem('username');
    var password = getItem('password');
    var baseURL = getItem('baseURL');
    var xhr = new XMLHttpRequest();
    xhr.xhrTimeout = setTimeout(function(){ xhrAbort(xhr); }, 10000);
    xhr.onreadystatechange = function() { callback(xhr); };
    xhr.onabort = abort;
    if(connectionStatus == 'session expired') {
        xhr.open("POST", baseURL + "j_spring_security_check", false);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.send("j_username=" + username + "&j_password=" + password + "&spring-security-redirect=/status.json");
    } else {
    try {
        var url = baseURL + "status.json";
        xhr.open("GET", url, true);
        xhr.send();
        } catch(e) {}
    }
}

function logoutAjax() {
    var xhr = new XMLHttpRequest();
    var baseURL = getItem('baseURL');
    var url = baseURL + "j_spring_security_logout";
    xhr.open("GET", url, true);
    xhr.send();
}

function xhrAbort(xhr) {
   xhr.abort();
}

function abort() {
   previousConnectionStatus = connectionStatus;
   connectionStatus = undefined;
}

function loginSuccess(xhr) {
    if (xhr.readyState == 4 && xhr.status == 200) {
       if(xhr.xhrTimeout !== undefined) {
        clearTimeout(xhr.xhrTimeout);
       }
        var response = parseJSON(xhr.responseText);
        if (response.status !== undefined) {
            previousConnectionStatus = connectionStatus;
            connectionStatus = response.status;
        } else {
            alert(response.status);
        }
    }
}

function afterLoginSuccess() {
    getPersonnelInfo();
}

function getPersonnelInfo() {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4 && xhr.status == 200) {
            setItem("personnel", xhr.responseText);
            personnel = parseJSON(xhr.responseText);
            getCenterList();
        }
    };

    var baseURL = getItem('baseURL');
    xhr.open("GET", baseURL + "personnel/id-current.json", false);
    xhr.send();
}

function getCenterList() {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4 && xhr.status == 200) {
            centerList = parseJSON(xhr.responseText).centers;
            setItem("centerList", JSON.stringify(centerList));
            for (var i = 0; i < centerList.length; i++) {
                getAndStoreCollectionSheet(centerList[i].id);
            }
            createCenterList();
        }
    };

    var baseURL = getItem('baseURL');
    xhr.open("GET", baseURL + "personnel/clients/id-current.json", false);
    xhr.send();
}

function createCenterList() {
    var centerListData = getItem("centerList");
    if(centerListData == undefined) {
      if(connectionStatus == "Success") {
        afterLoginSuccess();
      }
        return;
    }
    centerList = parseJSON(centerListData);
    var htmlStr = "<b>Centers :</b>";
    for (var i = 0; i < centerList.length; i++) {
        htmlStr += "<input type=button value='" + centerList[i].displayName + "' onclick='showCollectionSheetHandler(" + centerList[i].id + ")'></input>";
    }
    if(centerList.length == 0) {
         htmlStr = "No centers found, make sure you are logged in as a loan officer.";
    }
    $("#centerList").html(htmlStr);
}

function getAndStoreCollectionSheet(centerId) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4 && xhr.status == 200) {
            setItem("collectionData_" + centerId, xhr.responseText);
        }
    };

    var baseURL = getItem('baseURL');
    // localStorage is not asnc
    xhr.open("GET", baseURL + "collectionsheet/customer/id-" + centerId + ".json", false);
    xhr.send();
}

function showCollectionSheetHandler(centerId) {
    checkNull(centerId)
    setItem('currentCenter', centerId);
    currentCenter = centerId;
    loadCollectionSheetUI();
}

function loadCollectionSheetUI() {
    checkNull(currentCenter)
    collectionData = parseJSON(getItem('collectionData_' + currentCenter));
    if (collectionData == undefined) {
        getAndStoreCollectionSheet(currentCenter);
        collectionData = parseJSON(getItem('collectionData_' + currentCenter));
        checkNull(collectionData)
    }
    date = collectionData.date[0] + "-" + collectionData.date[1] + "-" + collectionData.date[2];
    loadCenterGroupsAndClients();
    buildCollectionSheet();
}

function saveInput(e) {
    var element = $(e.target);
    var id = element.attr('id');
    checkNull(id);
    var value = element.val();
    setItem("inputField_"+currentCenter+"_" + id, value);
}

function checkNull(arg) {
    if (arg == null || arg == undefined) {
        alert("Something went wrong, please report the bug with steps to reproduce it");
    }
}

function loadCenterGroupsAndClients() {
    center = null;
    groups = [];
    clients = [];
    for (var i = 0; i < collectionData.collectionSheetCustomer.length; i++) {
        var customer = collectionData.collectionSheetCustomer[i];
        if (customer.levelId == CENTER_LEVEL) {
            center = customer;
        } else if (customer.levelId == GROUP_LEVEL) {
            groups.push(customer);
        } else if (customer.levelId == CLIENT_LEVEL) {
            clients.push(customer);
        }
    }
}

//-------------------------------------------------

function checkSuccess(xhr) {
    if (xhr.readyState == 4 && xhr.status == 200) {
        var response = parseJSON(xhr.responseText);
        if (response.status == 'Success') {
            var saveCollectionsheet = buildSaveCollectionsheet();
            sendSaveCollectionSheetJSON(saveCollectionsheet);
        } else if (response.status == 'session expired') {
            alert("Wrong username/password!!! Make sure you are able to login to Mifos using " + baseURL + "login.ftl");
        } else {
            alert(response.status);
        }
    }
}

function sendSaveCollectionSheetJSON(saveCollectionsheet) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4 && xhr.status == 200) {
            var response = parseJSON(xhr.responseText);
            if (response.invalidCollectionSheet.length > 0) {
                var reasons = "";
                for (var i = 0; i < response.invalidCollectionSheet.length; i++) {
                    reasons += response.invalidCollectionSheet[i] + "\n";
                }
                $("#errors").html(reasons);
            } else if (response.errors !== null && response.errors !== "") {
                $("#errors").html(response.errors + $("#errors").html());
            } else {
                alert("Submitted successfully");
                window.localStorage.removeItem('collectionData_' + currentCenter);
                removeSavedInputFields()
                placeHolder.html('');
                loadCollectionSheetUI();
            }
        }
    };

    var baseURL = getItem('baseURL');
    xhr.open("POST", baseURL + "collectionsheet/save.json", false);
    xhr.setRequestHeader("Content-type", "application/json");
    var param = {};
    param.json = JSON.stringify(saveCollectionsheet);
    xhr.send(JSON.stringify(param));
}

function removeSavedInputFields() {
    for (i = 0; i < localStorage.length; i++) {
        key = localStorage.key(i);
        if (key.match("inputField_"+currentCenter+"_.*")) {
            localStorage.removeItem(key);
        }
    }
}

function submitCollectionsheet() {
    loginAjax(checkSuccess)
}

// -----------------------------------------------------------------------
// Create diplay HTML of collectionsheet

function buildCollectionSheet() {
    var htmlStr = "";

    if(debug == true) {
     htmlStr += "<input type=button id='showJSON' onclick='showSaveCollectionsheet()' value='Show Save Collectionsheet JSON' />"
             + "<div id='saveJSON'></div>"
             + "<input type=button id='fillDefaultPayments' onclick='fillDefaultPayments()' value='Fill default payments'>";
   }
    personnel = parseJSON(getItem('personnel'));
    htmlStr += "<div id='heading'>\n"
                 + "<div>Collectionsheet : " + center.name + " </div>\n"
                 + "<div> Date : " + date + "</div>\n"
                 + "<div>Loan Officer : " + personnel.displayName + " </div>\n"
             + "</div>";

    htmlStr += "<div id='collectionsheetForm'>\n"
       + "<div id='clients'></div>\n"
       + "<div id='groups'></div>\n"
       + "<div id='center'></div>\n"
       + "<div id='total'></div>\n"
    + "</div>\n";
    placeHolder.html(htmlStr);
    buildClientsDataCollection();
    buildGroupsDataCollection();
    buildCenterDataCollection();
    buildTotalDataCollection();
    addInputKeyFilter();
    addChangeInputListener();
}


function addChangeInputListener() {
    var form = $("#collectionsheetForm");
    var inputElements = form.find("input");
    inputElements.change(saveInput);
}

function addInputKeyFilter() {
	var tags = $('input[class*=mask-pnum]');
	for (var key in $.fn.keyfilter.defaults.masks)
	{
		tags.filter('.mask-' + key).keyfilter($.fn.keyfilter.defaults.masks[key]);
	}
}

function buildCenterDataCollection() {
    $("#center").html("<div id='center_" + center.customerId + "' class='section'>"
                         +"<span>" + center.name + " : " + center.customerId + "</span>" 
                         + createInputFields(center) 
                     + "\n</div>\n");
}

function buildGroupsDataCollection() {
    var groupsHTML = "";
    for (var i = 0; i < groups.length; i++) {
        groupsHTML += "<div id='group_" + groups[i].customerId + "' class='section'>\n"
                             +"<span>" + groups[i].name + " : " + groups[i].customerId + "</span>" 
                             + createInputFields(groups[i]) 
                     + "\n</div>\n";
    }
    $("#groups").html(groupsHTML);
}

function buildClientsDataCollection() {
    var clientsHTML = "";
    for (var i = 0; i < clients.length; i++) {
        clientsHTML += "<div id='client_" + clients[i].customerId + "' class='section'>\n"
                         + "<span>" + clients[i].name + " : " + clients[i].customerId + "</span>" 
                         + createInputFields(clients[i]) 
                     + "</div>\n";
    }
    $("#clients").html(clientsHTML);
}

function createInputFields(customer) {
    var inputFieldsHTML = "";
    inputFieldsHTML += buildInputFieldsForLoans(customer.collectionSheetCustomerLoan, customer.customerId);
    inputFieldsHTML += buildInputFieldsForSavings(customer.collectionSheetCustomerSaving, customer.customerId);
    inputFieldsHTML += buildInputFieldsForSavings(customer.individualSavingAccounts, customer.customerId);
    inputFieldsHTML += buildInputFieldsForCustomerFees(customer.collectionSheetCustomerAccount, customer.customerId);
    return inputFieldsHTML;
}

function buildInputFieldsForCustomerFees(customerFee, customerId) {
    var id = "fee_" + customerFee.accountId + "_" + customerId;
    var value = getItem("inputField_"+currentCenter+"_"+id);
    if (value == null || value == undefined) {
        value = 0;
    }
    var loansHTML = "<hr /><div class='account'>\n" 
                            + "<span> Fee : " + customerFee.accountId + "</span>\n" 
                            + "<span>Collection</span>\n" 
                            + "<input id='" + id + "' type='text' class='mask-pnum' value='" + value + "' />\n" 
                            + "<span class='due'>(Due : <span id='"+id+"_recommended'>" 
                            + customerFee.totalCustomerAccountCollectionFee + "</span>)</span>\n" 
                        + "</div>\n";
    return loansHTML;
}

function buildInputFieldsForLoans(loans, customerId) {
    var loansHTML = "";
    for (var i = 0; i < loans.length; i++) {
        var id = "loan_" + loans[i].accountId + "_" + customerId;
        var value = getItem("inputField_"+currentCenter+"_"+id);
        if (value == null || value == undefined) {
            value = 0;
        }
        loansHTML += "<hr />\n<div class='account'>\n" 
                            + "<span> Loan " + loans[i].productShortName + " : " + loans[i].accountId + "</span>\n" 
                     if(loans[i].totalDisbursement == 0) {
                           loansHTML += "<span>Repayment</span>\n" 
                            	     + "<input id='" + id + "' type='text' class='mask-pnum' value='" + value + "' />\n" 
                                     + "<span class='due'>(Due : <span id='"+id+"_recommended'>" 
                                     + loans[i].totalRepaymentDue + "</span>)</span>\n"
                      } else {
                           loansHTML += "<span>Disbursement</span>\n" 
                                     + "<input id='" + id + "' type='text' class='mask-pnum' class='mask-pnum' value='" + value + "' />\n" 
                                     + "<span class='due'>(Default : <span id='"+id+"_recommended'>" 
                                     + loans[i].totalDisbursement + "</span>)</span>\n"
                      }
         loansHTML += "</div>\n";
    }
    return loansHTML;
}

function buildInputFieldsForSavings(savings, customerId) {
    var savingsHTML = "";
    for (var i = 0; i < savings.length; i++) {
        var depositId = "deposit_" + savings[i].accountId + "_" + customerId;
        var depositValue = getItem("inputField_"+currentCenter+"_"+depositId);
        if (depositValue == null || depositValue == undefined) {
            depositValue = 0;
        }
        var withdrawalId = "withdrawal_" + savings[i].accountId + "_" + customerId;
        var withdrawalValue = getItem("inputField_"+currentCenter+"_"+withdrawalId);
        if (withdrawalValue == null || withdrawalValue == undefined) {
            withdrawalValue = 0;
        }
        savingsHTML += "<hr />\n<div class='account'>\n" 
                                + "<span> Savings " + savings[i].productShortName + " : " + savings[i].accountId + "</span>\n" 
                                + "<span>Deposit</span><input id='" + depositId + "' type='text' class='mask-pnum' value='" + depositValue + "' />\n" 
                                + "<span class='due'>(Due : <span id='"+depositId+"_recommended'>" + savings[i].depositDue + "</span>)</span>\n" 
                                + "<div><span>-</span>"
                                +"<span>Withdrawal</span>\n" + "<input id='" + withdrawalId 
                                + "' type='text' class='mask-pnum' value='" + withdrawalValue + "'/></div>\n" 
                            + "</div>\n";
    }
    return savingsHTML;
}

function buildTotalDataCollection() {
    $("#total").html("\n");
}

// ------------------------------------------------------------------------------------
// Assemble JSON required for collectionsheet save REST operation 
/*
 *
 */

function buildSaveCollectionsheet() {
    saveCollectionSheet = {}
    saveCollectionSheet.userId = 1;
    saveCollectionSheet.transactionDate = collectionData.date;
    saveCollectionSheet.paymentType = 1
    saveCollectionSheet.receiptId = "";
    saveCollectionSheet.receiptDate = null;
    saveCollectionSheet.saveCollectionSheetCustomers = [];

    var saveCustomer;

    saveCustomer = createSaveCustomer(center);
    saveCollectionSheet.saveCollectionSheetCustomers.push(saveCustomer);

    for (var i = 0; i < groups.length; i++) {
        saveCustomer = createSaveCustomer(groups[i]);
        saveCollectionSheet.saveCollectionSheetCustomers.push(saveCustomer);
    }

    for (var i = 0; i < clients.length; i++) {
        saveCustomer = createSaveCustomer(clients[i]);
        saveCollectionSheet.saveCollectionSheetCustomers.push(saveCustomer);
    }

    return saveCollectionSheet;
}


function createSaveCustomer(customer) {
    var saveCustomer = {};
    saveCustomer.customerId = customer.customerId;
    saveCustomer.parentCustomerId = customer.parentCustomerId;
    if (customer.levelId == CLIENT_LEVEL) {
        saveCustomer.attendanceId = 1;
    } else {
        saveCustomer.attendanceId = null;
    }
    saveCustomer.saveCollectionSheetCustomerSavings = createSavings(customer.collectionSheetCustomerSaving);
    saveCustomer.saveCollectionSheetCustomerIndividualSavings = createSavings(customer.individualSavingAccounts);
    saveCustomer.saveCollectionSheetCustomerLoans = createLoans(customer.collectionSheetCustomerLoan);
    saveCustomer.saveCollectionSheetCustomerAccount = createCustomerAccount(customer);
    return saveCustomer;
}

function createSavings(savings) {
    var savingsArray = [];
    for (var i = 0; i < savings.length; i++) {
        var cSavings = {};
        var account = savings[i];
        cSavings.accountId = account.accountId;
        cSavings.currencyId = account.currencyId;
        cSavings.totalDeposit = $("#deposit_" + account.accountId + "_" + account.customerId).val();
        checkNull(cSavings.totalDeposit);
        cSavings.totalWithdrawal = $("#withdrawal_" + account.accountId + "_" + account.customerId).val();
        checkNull(cSavings.totalWithdrawal);
        savingsArray.push(cSavings)
    }
    return savingsArray;
}

function createLoans(loans) {
    var loanArray = [];
    for (var i = 0; i < loans.length; i++) {
        var cloan = {};
        var account = loans[i];
        cloan.accountId = account.accountId;
        cloan.currencyId = account.currencyId;
        cloan.totalDisbursement = account.totalDisbursement;
        checkNull(cloan.totalDisbursement);
        cloan.totalLoanPayment = $("#loan_" + account.accountId + "_" + account.customerId).val();
        checkNull(cloan.totalLoanPayment);
        loanArray.push(cloan)
    }
    return loanArray;
}

function createCustomerAccount(customer) {
    var account = customer.collectionSheetCustomerAccount;
    var cAccount = {};
    if (account.accountId == -1) {
        return null;
    }
    cAccount.accountId = account.accountId;
    cAccount.currencyId = account.currencyId;
    cAccount.totalCustomerAccountCollectionFee = $("#fee_" + account.accountId + "_" + customer.customerId).val();
    checkNull(cAccount.totalCustomerAccountCollectionFee);
    return cAccount;
}

//---------------------------------------------------------------------------------------
//   The localStorage display JS

function listAllItems() {
    var htmlStr = "<div class='localStorage'>";
    for (i = 0; i < localStorage.length; i++) {
        key = localStorage.key(i);
        if (key.match("collectionData_[0-9]*")) {
            val = localStorage.getItem(key);
            htmlStr += "<span>" + key + "</span><span class='val'>" + val + "</span></div><div class='localStorage'>";
        }
    }
    for (i = 0; i < localStorage.length; i++) {
        key = localStorage.key(i);
        if (!key.match("collectionData_[0-9]*")) {
            val = localStorage.getItem(key);
            htmlStr += "<span>" + key + "</span><span class='val'>" + val + "</span></div><div class='localStorage'>";
        }
    }
    htmlStr += "</div>";
    placeHolder.html(htmlStr);
    $("span.val").dblclick(expand);
}

function expand(e) {
    var element = $(e.target);
    if (element.hasClass('smallText')) {
        element.removeClass('smallText');
    } else {
        element.addClass('smallText');
    }
}

//---------------------------------------------------------------------------------------
//   show json structure that will be send to save collection REST call

function clearShowSaveCollectionsheet() {
    $("#saveJSON").html("");
    $("#showJSON").click(showSaveCollectionsheet);
    $("#showJSON").val('Show Save Collectionsheet JSON');
}

function showSaveCollectionsheet() {
    $("#saveJSON").html(JSON.stringify(buildSaveCollectionsheet()));
    $("#showJSON").attr('onclick', '');
    $("#showJSON").click(clearShowSaveCollectionsheet);
    $("#showJSON").val('Okay, Now Hide JSON')
}

function fillDefaultPayments() {
    var inputElements = $('input.mask-pnum');
    for(var i = 0; i < inputElements.length; i++) {
       var ele = $(inputElements[i]);
       var id = ele.attr('id');
       var recommendedAmountHolder = $("#"+id+"_recommended");
       var recommendedAmount = 0;
       if(recommendedAmountHolder !== undefined && recommendedAmountHolder !== null) {
          recommendedAmount = recommendedAmountHolder.html();
       }
       ele.val(recommendedAmount);
       ele.trigger('change');
    }
}

//----------------------------------------------------------------------------------------

function getItem(id) {
    var val =  window.localStorage.getItem(id);
    if(val == null) {
        return undefined;
    }
   return val;
}

function setItem(id, val) {
    if(id == undefined || val == undefined) {
        return;
    }
    return window.localStorage.setItem(id, val);
}

function parseJSON(txt) {
    if(txt == null || txt == undefined) {
       return undefined;
    }
    return JSON.parse(txt)
}

$(document).ready(init);
