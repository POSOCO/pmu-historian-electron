var cacheData_ = null;

function fetchHistorianData(flag) {
  // https://github.com/doedje/jquery.soap - JQUERY SOAP PLUGIN
  var webServiceURL = document.getElementById("serverBaseAddressInput").value;

  var username_ = "perf1";
  var password_ = "Abcd@1234";

  var cacheData_ = "";
  if (flag == 0) {
    var soapMessage =
      '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:dat="http://www.eterra.com/public/services/data/dataTypes">\
     <soap:Header/>\
     <soap:Body>\
        <dat:DiscoverServerRequest>?</dat:DiscoverServerRequest>\
     </soap:Body>\
  </soap:Envelope>';
  } else if (flag == 1) {
    var soapMessage =
      '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:dat="http://www.eterra.com/public/services/data/dataTypes">\
   <soap:Header/>\
   <soap:Body>\
      <dat:DataRequest>\
         <measurementIDList>\
            <!--Zero or more repetitions:-->\
            <measurementId>525</measurementId>\
          </measurementIDList>\
         <timeRange>\
            <startTime>2017-02-02T01:00:05.000+05:30</startTime>\
            <endTime>2017-02-02T01:00:07.000+05:30</endTime>\
         </timeRange>\
         <!--Optional:-->\
         <sampleRate>25</sampleRate>\
         <!--Optional:-->\
          < /dat:DataRequest>\ < /soap:Body>\ < /soap:Envelope>';
  }

  var OnSuccess = function(data) {
    cacheData_ = data;
    WriteLineConsole(JSON.stringify(data));
  };

  var OnError = function(jqXHR, textStatus, errorThrown) {
    WriteLineConsole(JSON.stringify(jqXHR));
    console.log(textStatus, errorThrown);
  };
  
  $.ajax({
    url: webServiceURL,
    type: "POST",
    dataType: "xml",
    data: soapMessage,
    beforeSend: function(xhr) {
      /* Authorization header */
      xhr.setRequestHeader("Authorization", "Basic " + btoa(username_ + ":" + password_));
    },
    processData: false,
    contentType: "text/xml; charset=\"utf-8\"",
    success: OnSuccess,
    error: OnError
  });
}

function plotData() {
  var data = cacheData_;
  var plotData = [{
    x: [],
    y: [],
    type: 'scatter'
  }];
  for (var i = 0; i < data.length; i++) {
    plotData[0].x[i] = new Date(data[i].timestamp);
    plotData[0].y[i] = data[i].dval;
  }
  Plotly.newPlot('plotDiv', plotData);
}
