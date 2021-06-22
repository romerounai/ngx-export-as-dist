(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('@angular/core'), require('rxjs'), require('html2canvas'), require('xlsx'), require('html2pdf.js')) :
    typeof define === 'function' && define.amd ? define('ngx-export-as', ['exports', '@angular/core', 'rxjs', 'html2canvas', 'xlsx', 'html2pdf.js'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global['ngx-export-as'] = {}, global.ng.core, global.rxjs, global.html2canvas, global.XLSX, global.html2pdf));
}(this, (function (exports, core, rxjs, html2canvas, XLSX, html2pdf) { 'use strict';

    function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

    function _interopNamespace(e) {
        if (e && e.__esModule) return e;
        var n = Object.create(null);
        if (e) {
            Object.keys(e).forEach(function (k) {
                if (k !== 'default') {
                    var d = Object.getOwnPropertyDescriptor(e, k);
                    Object.defineProperty(n, k, d.get ? d : {
                        enumerable: true,
                        get: function () {
                            return e[k];
                        }
                    });
                }
            });
        }
        n['default'] = e;
        return Object.freeze(n);
    }

    var html2canvas__default = /*#__PURE__*/_interopDefaultLegacy(html2canvas);
    var XLSX__namespace = /*#__PURE__*/_interopNamespace(XLSX);
    var html2pdf__default = /*#__PURE__*/_interopDefaultLegacy(html2pdf);

    window['html2canvas'] = html2canvas__default['default'];
    var ExportAsService = /** @class */ (function () {
        function ExportAsService() {
        }
        /**
         * Main base64 get method, it will return the file as base64 string
         * @param config your config
         */
        ExportAsService.prototype.get = function (config) {
            // structure method name dynamically by type
            var func = 'get' + config.type.toUpperCase();
            // if type supported execute and return
            if (this[func]) {
                return this[func](config);
            }
            // throw error for unsupported formats
            return new rxjs.Observable(function (observer) { observer.error('Export type is not supported.'); });
        };
        /**
         * Save exported file in old javascript way
         * @param config your custom config
         * @param fileName Name of the file to be saved as
         */
        ExportAsService.prototype.save = function (config, fileName) {
            // set download
            config.download = true;
            // get file name with type
            config.fileName = fileName + '.' + config.type;
            return this.get(config);
        };
        /**
         * Converts content string to blob object
         * @param content string to be converted
         */
        ExportAsService.prototype.contentToBlob = function (content) {
            return new rxjs.Observable(function (observer) {
                // get content string and extract mime type
                var arr = content.split(','), mime = arr[0].match(/:(.*?);/)[1], bstr = atob(arr[1]);
                var n = bstr.length;
                var u8arr = new Uint8Array(n);
                while (n--) {
                    u8arr[n] = bstr.charCodeAt(n);
                }
                observer.next(new Blob([u8arr], { type: mime }));
                observer.complete();
            });
        };
        /**
         * Removes base64 file type from a string like "data:text/csv;base64,"
         * @param fileContent the base64 string to remove the type from
         */
        ExportAsService.prototype.removeFileTypeFromBase64 = function (fileContent) {
            var re = /^data:[^]*;base64,/g;
            var newContent = re[Symbol.replace](fileContent, '');
            return newContent;
        };
        /**
         * Structure the base64 file content with the file type string
         * @param fileContent file content
         * @param fileMime file mime type "text/csv"
         */
        ExportAsService.prototype.addFileTypeToBase64 = function (fileContent, fileMime) {
            return "data:" + fileMime + ";base64," + fileContent;
        };
        /**
         * create downloadable file from dataURL
         * @param fileName downloadable file name
         * @param dataURL file content as dataURL
         */
        ExportAsService.prototype.downloadFromDataURL = function (fileName, dataURL) {
            var _this = this;
            // create blob
            this.contentToBlob(dataURL).subscribe(function (blob) {
                // download the blob
                _this.downloadFromBlob(blob, fileName);
            });
        };
        /**
         * Downloads the blob object as a file
         * @param blob file object as blob
         * @param fileName downloadable file name
         */
        ExportAsService.prototype.downloadFromBlob = function (blob, fileName) {
            // get object url
            var url = window.URL.createObjectURL(blob);
            // check for microsoft internet explorer
            if (window.navigator && window.navigator.msSaveOrOpenBlob) {
                // use IE download or open if the user using IE
                window.navigator.msSaveOrOpenBlob(blob, fileName);
            }
            else {
                this.saveFile(fileName, url);
            }
        };
        ExportAsService.prototype.saveFile = function (fileName, url) {
            // if not using IE then create link element
            var element = document.createElement('a');
            // set download attr with file name
            element.setAttribute('download', fileName);
            // set the element as hidden
            element.style.display = 'none';
            // append the body
            document.body.appendChild(element);
            // set href attr
            element.href = url;
            // click on it to start downloading
            element.click();
            // remove the link from the dom
            document.body.removeChild(element);
        };
        ExportAsService.prototype.getPDF = function (config) {
            var _this = this;
            return new rxjs.Observable(function (observer) {
                if (!config.options) {
                    config.options = {};
                }
                config.options.filename = config.fileName;
                var element = document.getElementById(config.elementIdOrContent);
                var pdf = html2pdf__default['default']().set(config.options).from(element ? element : config.elementIdOrContent);
                var download = config.download;
                var pdfCallbackFn = config.options.pdfCallbackFn;
                if (download) {
                    if (pdfCallbackFn) {
                        _this.applyPdfCallbackFn(pdf, pdfCallbackFn).save();
                    }
                    else {
                        pdf.save();
                    }
                    observer.next();
                    observer.complete();
                }
                else {
                    if (pdfCallbackFn) {
                        _this.applyPdfCallbackFn(pdf, pdfCallbackFn).outputPdf('datauristring').then(function (data) {
                            observer.next(data);
                            observer.complete();
                        });
                    }
                    else {
                        pdf.outputPdf('datauristring').then(function (data) {
                            observer.next(data);
                            observer.complete();
                        });
                    }
                }
            });
        };
        ExportAsService.prototype.applyPdfCallbackFn = function (pdf, pdfCallbackFn) {
            return pdf.toPdf().get('pdf').then(function (pdfRef) {
                pdfCallbackFn(pdfRef);
            });
        };
        ExportAsService.prototype.getPNG = function (config) {
            var _this = this;
            return new rxjs.Observable(function (observer) {
                var element = document.getElementById(config.elementIdOrContent);
                html2canvas__default['default'](element, config.options).then(function (canvas) {
                    var imgData = canvas.toDataURL('image/PNG');
                    if (config.type === 'png' && config.download) {
                        _this.downloadFromDataURL(config.fileName, imgData);
                        observer.next();
                    }
                    else {
                        observer.next(imgData);
                    }
                    observer.complete();
                }, function (err) {
                    observer.error(err);
                });
            });
        };
        ExportAsService.prototype.getCSV = function (config) {
            var _this = this;
            return new rxjs.Observable(function (observer) {
                var element = document.getElementById(config.elementIdOrContent);
                var csv = [];
                var rows = element.querySelectorAll('table tr');
                for (var index = 0; index < rows.length; index++) {
                    var rowElement = rows[index];
                    var row = [];
                    var cols = rowElement.querySelectorAll('td, th');
                    for (var colIndex = 0; colIndex < cols.length; colIndex++) {
                        var col = cols[colIndex];
                        row.push(col.innerText);
                    }
                    csv.push(row.join(','));
                }
                var csvContent = 'data:text/csv;base64,' + _this.btoa(csv.join('\n'));
                if (config.download) {
                    _this.downloadFromDataURL(config.fileName, csvContent);
                    observer.next();
                }
                else {
                    observer.next(csvContent);
                }
                observer.complete();
            });
        };
        ExportAsService.prototype.getTXT = function (config) {
            var nameFrags = config.fileName.split('.');
            config.fileName = nameFrags[0] + ".txt";
            return this.getCSV(config);
        };
        ExportAsService.prototype.getXLS = function (config) {
            var _this = this;
            return new rxjs.Observable(function (observer) {
                var element = document.getElementById(config.elementIdOrContent);
                var ws3 = XLSX__namespace.utils.table_to_sheet(element, config.options);
                var wb = XLSX__namespace.utils.book_new();
                XLSX__namespace.utils.book_append_sheet(wb, ws3, config.fileName);
                var out = XLSX__namespace.write(wb, { type: 'base64' });
                var xlsContent = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + out;
                if (config.download) {
                    _this.downloadFromDataURL(config.fileName, xlsContent);
                    observer.next();
                }
                else {
                    observer.next(xlsContent);
                }
                observer.complete();
            });
        };
        ExportAsService.prototype.getXLSX = function (config) {
            return this.getXLS(config);
        };
        // private getDOCX(config: ExportAsConfig): Observable<string | null> {
        //   return new Observable((observer) => {
        //     const contentDocument: string = document.getElementById(config.elementIdOrContent).outerHTML;
        //     const content = '<!DOCTYPE html>' + contentDocument;
        //     HTMLtoDOCX(content, null, config.options).then(converted => {
        //       if (config.download) {
        //         const blob = new Blob([converted]);
        //         this.downloadFromBlob(converted, config.fileName);
        //         observer.next();
        //         observer.complete();
        //       } else {
        //         const reader = new FileReader();
        //         reader.onloadend = () => {
        //           const base64data = reader.result as string;
        //           observer.next(base64data);
        //           observer.complete();
        //         };
        //         reader.readAsDataURL(converted);
        //       }
        //     });
        //   });
        // }
        // private getDOC(config: ExportAsConfig): Observable<string | null> {
        //   return this.getDOCX(config);
        // }
        ExportAsService.prototype.getJSON = function (config) {
            var _this = this;
            return new rxjs.Observable(function (observer) {
                var data = []; // first row needs to be headers
                var headers = [];
                var table = document.getElementById(config.elementIdOrContent);
                for (var index = 0; index < table.rows[0].cells.length; index++) {
                    headers[index] = table.rows[0].cells[index].innerHTML.toLowerCase().replace(/ /gi, '');
                }
                // go through cells
                for (var i = 1; i < table.rows.length; i++) {
                    var tableRow = table.rows[i];
                    var rowData = {};
                    for (var j = 0; j < tableRow.cells.length; j++) {
                        rowData[headers[j]] = tableRow.cells[j].innerHTML;
                    }
                    data.push(rowData);
                }
                var jsonString = JSON.stringify(data);
                var jsonBase64 = _this.btoa(jsonString);
                var dataStr = 'data:text/json;base64,' + jsonBase64;
                if (config.download) {
                    _this.downloadFromDataURL(config.fileName, dataStr);
                    observer.next();
                }
                else {
                    observer.next(data);
                }
                observer.complete();
            });
        };
        ExportAsService.prototype.getXML = function (config) {
            var _this = this;
            return new rxjs.Observable(function (observer) {
                var xml = '<?xml version="1.0" encoding="UTF-8"?><Root><Classes>';
                var tritem = document.getElementById(config.elementIdOrContent).getElementsByTagName('tr');
                for (var i = 0; i < tritem.length; i++) {
                    var celldata = tritem[i];
                    if (celldata.cells.length > 0) {
                        xml += '<Class name="' + celldata.cells[0].textContent + '">\n';
                        for (var m = 1; m < celldata.cells.length; ++m) {
                            xml += '\t<data>' + celldata.cells[m].textContent + '</data>\n';
                        }
                        xml += '</Class>\n';
                    }
                }
                xml += '</Classes></Root>';
                var base64 = 'data:text/xml;base64,' + _this.btoa(xml);
                if (config.download) {
                    _this.downloadFromDataURL(config.fileName, base64);
                    observer.next();
                }
                else {
                    observer.next(base64);
                }
                observer.complete();
            });
        };
        ExportAsService.prototype.btoa = function (content) {
            return btoa(unescape(encodeURIComponent(content)));
        };
        return ExportAsService;
    }());
    ExportAsService.decorators = [
        { type: core.Injectable }
    ];
    ExportAsService.ctorParameters = function () { return []; };

    /**
     * angular imports
     */
    var ExportAsModule = /** @class */ (function () {
        function ExportAsModule() {
        }
        return ExportAsModule;
    }());
    ExportAsModule.decorators = [
        { type: core.NgModule, args: [{
                    providers: [ExportAsService],
                },] }
    ];

    /*
     * Public API Surface of ngx-export-as
     */

    /**
     * Generated bundle index. Do not edit.
     */

    exports.ExportAsModule = ExportAsModule;
    exports.ExportAsService = ExportAsService;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=ngx-export-as.umd.js.map
