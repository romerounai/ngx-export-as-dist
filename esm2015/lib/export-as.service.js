import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
// import HTMLtoDOCX from 'html-to-docx';
import html2pdf from 'html2pdf.js';
window['html2canvas'] = html2canvas;
export class ExportAsService {
    constructor() { }
    /**
     * Main base64 get method, it will return the file as base64 string
     * @param config your config
     */
    get(config) {
        // structure method name dynamically by type
        const func = 'get' + config.type.toUpperCase();
        // if type supported execute and return
        if (this[func]) {
            return this[func](config);
        }
        // throw error for unsupported formats
        return new Observable((observer) => { observer.error('Export type is not supported.'); });
    }
    /**
     * Save exported file in old javascript way
     * @param config your custom config
     * @param fileName Name of the file to be saved as
     */
    save(config, fileName) {
        // set download
        config.download = true;
        // get file name with type
        config.fileName = fileName + '.' + config.type;
        return this.get(config);
    }
    /**
     * Converts content string to blob object
     * @param content string to be converted
     */
    contentToBlob(content) {
        return new Observable((observer) => {
            // get content string and extract mime type
            const arr = content.split(','), mime = arr[0].match(/:(.*?);/)[1], bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            observer.next(new Blob([u8arr], { type: mime }));
            observer.complete();
        });
    }
    /**
     * Removes base64 file type from a string like "data:text/csv;base64,"
     * @param fileContent the base64 string to remove the type from
     */
    removeFileTypeFromBase64(fileContent) {
        const re = /^data:[^]*;base64,/g;
        const newContent = re[Symbol.replace](fileContent, '');
        return newContent;
    }
    /**
     * Structure the base64 file content with the file type string
     * @param fileContent file content
     * @param fileMime file mime type "text/csv"
     */
    addFileTypeToBase64(fileContent, fileMime) {
        return `data:${fileMime};base64,${fileContent}`;
    }
    /**
     * create downloadable file from dataURL
     * @param fileName downloadable file name
     * @param dataURL file content as dataURL
     */
    downloadFromDataURL(fileName, dataURL) {
        // create blob
        this.contentToBlob(dataURL).subscribe(blob => {
            // download the blob
            this.downloadFromBlob(blob, fileName);
        });
    }
    /**
     * Downloads the blob object as a file
     * @param blob file object as blob
     * @param fileName downloadable file name
     */
    downloadFromBlob(blob, fileName) {
        // get object url
        const url = window.URL.createObjectURL(blob);
        // check for microsoft internet explorer
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
            // use IE download or open if the user using IE
            window.navigator.msSaveOrOpenBlob(blob, fileName);
        }
        else {
            this.saveFile(fileName, url);
        }
    }
    saveFile(fileName, url) {
        // if not using IE then create link element
        const element = document.createElement('a');
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
    }
    getPDF(config) {
        return new Observable((observer) => {
            if (!config.options) {
                config.options = {};
            }
            config.options.filename = config.fileName;
            const element = document.getElementById(config.elementIdOrContent);
            const pdf = html2pdf().set(config.options).from(element ? element : config.elementIdOrContent);
            const download = config.download;
            const pdfCallbackFn = config.options.pdfCallbackFn;
            if (download) {
                if (pdfCallbackFn) {
                    this.applyPdfCallbackFn(pdf, pdfCallbackFn).save();
                }
                else {
                    pdf.save();
                }
                observer.next();
                observer.complete();
            }
            else {
                if (pdfCallbackFn) {
                    this.applyPdfCallbackFn(pdf, pdfCallbackFn).outputPdf('datauristring').then(data => {
                        observer.next(data);
                        observer.complete();
                    });
                }
                else {
                    pdf.outputPdf('datauristring').then(data => {
                        observer.next(data);
                        observer.complete();
                    });
                }
            }
        });
    }
    applyPdfCallbackFn(pdf, pdfCallbackFn) {
        return pdf.toPdf().get('pdf').then((pdfRef) => {
            pdfCallbackFn(pdfRef);
        });
    }
    getPNG(config) {
        return new Observable((observer) => {
            const element = document.getElementById(config.elementIdOrContent);
            html2canvas(element, config.options).then((canvas) => {
                const imgData = canvas.toDataURL('image/PNG');
                if (config.type === 'png' && config.download) {
                    this.downloadFromDataURL(config.fileName, imgData);
                    observer.next();
                }
                else {
                    observer.next(imgData);
                }
                observer.complete();
            }, err => {
                observer.error(err);
            });
        });
    }
    getCSV(config) {
        return new Observable((observer) => {
            const element = document.getElementById(config.elementIdOrContent);
            const csv = [];
            const rows = element.querySelectorAll('table tr');
            for (let index = 0; index < rows.length; index++) {
                const rowElement = rows[index];
                const row = [];
                const cols = rowElement.querySelectorAll('td, th');
                for (let colIndex = 0; colIndex < cols.length; colIndex++) {
                    const col = cols[colIndex];
                    row.push(col.innerText);
                }
                csv.push(row.join(','));
            }
            const csvContent = 'data:text/csv;base64,' + this.btoa(csv.join('\n'));
            if (config.download) {
                this.downloadFromDataURL(config.fileName, csvContent);
                observer.next();
            }
            else {
                observer.next(csvContent);
            }
            observer.complete();
        });
    }
    getTXT(config) {
        const nameFrags = config.fileName.split('.');
        config.fileName = `${nameFrags[0]}.txt`;
        return this.getCSV(config);
    }
    getXLS(config) {
        return new Observable((observer) => {
            const element = document.getElementById(config.elementIdOrContent);
            const ws3 = XLSX.utils.table_to_sheet(element, config.options);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws3, config.fileName);
            const out = XLSX.write(wb, { type: 'base64' });
            const xlsContent = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + out;
            if (config.download) {
                this.downloadFromDataURL(config.fileName, xlsContent);
                observer.next();
            }
            else {
                observer.next(xlsContent);
            }
            observer.complete();
        });
    }
    getXLSX(config) {
        return this.getXLS(config);
    }
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
    getJSON(config) {
        return new Observable((observer) => {
            const data = []; // first row needs to be headers
            const headers = [];
            const table = document.getElementById(config.elementIdOrContent);
            for (let index = 0; index < table.rows[0].cells.length; index++) {
                headers[index] = table.rows[0].cells[index].innerHTML.toLowerCase().replace(/ /gi, '');
            }
            // go through cells
            for (let i = 1; i < table.rows.length; i++) {
                const tableRow = table.rows[i];
                const rowData = {};
                for (let j = 0; j < tableRow.cells.length; j++) {
                    rowData[headers[j]] = tableRow.cells[j].innerHTML;
                }
                data.push(rowData);
            }
            const jsonString = JSON.stringify(data);
            const jsonBase64 = this.btoa(jsonString);
            const dataStr = 'data:text/json;base64,' + jsonBase64;
            if (config.download) {
                this.downloadFromDataURL(config.fileName, dataStr);
                observer.next();
            }
            else {
                observer.next(data);
            }
            observer.complete();
        });
    }
    getXML(config) {
        return new Observable((observer) => {
            let xml = '<?xml version="1.0" encoding="UTF-8"?><Root><Classes>';
            const tritem = document.getElementById(config.elementIdOrContent).getElementsByTagName('tr');
            for (let i = 0; i < tritem.length; i++) {
                const celldata = tritem[i];
                if (celldata.cells.length > 0) {
                    xml += '<Class name="' + celldata.cells[0].textContent + '">\n';
                    for (let m = 1; m < celldata.cells.length; ++m) {
                        xml += '\t<data>' + celldata.cells[m].textContent + '</data>\n';
                    }
                    xml += '</Class>\n';
                }
            }
            xml += '</Classes></Root>';
            const base64 = 'data:text/xml;base64,' + this.btoa(xml);
            if (config.download) {
                this.downloadFromDataURL(config.fileName, base64);
                observer.next();
            }
            else {
                observer.next(base64);
            }
            observer.complete();
        });
    }
    btoa(content) {
        return btoa(unescape(encodeURIComponent(content)));
    }
}
ExportAsService.decorators = [
    { type: Injectable }
];
ExportAsService.ctorParameters = () => [];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwb3J0LWFzLnNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9wcm9qZWN0cy9uZ3gtZXhwb3J0LWFzL3NyYy9saWIvZXhwb3J0LWFzLnNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUMzQyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBSWxDLE9BQU8sV0FBVyxNQUFNLGFBQWEsQ0FBQztBQUN0QyxPQUFPLEtBQUssSUFBSSxNQUFNLE1BQU0sQ0FBQztBQUM3Qix5Q0FBeUM7QUFDekMsT0FBTyxRQUFRLE1BQU0sYUFBYSxDQUFDO0FBQ25DLE1BQU0sQ0FBQyxhQUFhLENBQUMsR0FBRyxXQUFXLENBQUM7QUFHcEMsTUFBTSxPQUFPLGVBQWU7SUFFMUIsZ0JBQWdCLENBQUM7SUFFakI7OztPQUdHO0lBQ0gsR0FBRyxDQUFDLE1BQXNCO1FBQ3hCLDRDQUE0QztRQUM1QyxNQUFNLElBQUksR0FBRyxLQUFLLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUMvQyx1Q0FBdUM7UUFDdkMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDZCxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQztTQUMzQjtRQUVELHNDQUFzQztRQUN0QyxPQUFPLElBQUksVUFBVSxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQUUsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLCtCQUErQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM1RixDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILElBQUksQ0FBQyxNQUFzQixFQUFFLFFBQWdCO1FBQzNDLGVBQWU7UUFDZixNQUFNLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQztRQUN2QiwwQkFBMEI7UUFDMUIsTUFBTSxDQUFD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RyxDQUFDLEVBQUU7b0JBQzdCLEdBQUcsSUFBSSxlQUFlLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEdBQUcsTUFBTSxDQUFDO29CQUNoRSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLEVBQUU7d0JBQzlDLEdBQUcsSUFBSSxVQUFVLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDO3FCQUNqRTtvQkFDRCxHQUFHLElBQUksWUFBWSxDQUFDO2lCQUNyQjthQUNGO1lBQ0QsR0FBRyxJQUFJLG1CQUFtQixDQUFDO1lBQzNCLE1BQU0sTUFBTSxHQUFHLHVCQUF1QixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDeEQsSUFBSSxNQUFNLENBQUMsUUFBUSxFQUFFO2dCQUNuQixJQUFJLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsQ0FBQztnQkFDbEQsUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDO2FBQ2pCO2lCQUFNO2dCQUNMLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7YUFDdkI7WUFDRCxRQUFRLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDdEIsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRU8sSUFBSSxDQUFDLE9BQWU7UUFDMUIsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNyRCxDQUFDOzs7WUE3VEYsVUFBVSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEluamVjdGFibGUgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcclxuaW1wb3J0IHsgT2JzZXJ2YWJsZSB9IGZyb20gJ3J4anMnO1xyXG5cclxuaW1wb3J0IHsgRXhwb3J0QXNDb25maWcgfSBmcm9tICcuL2V4cG9ydC1hcy1jb25maWcubW9kZWwnO1xyXG5cclxuaW1wb3J0IGh0bWwyY2FudmFzIGZyb20gJ2h0bWwyY2FudmFzJztcclxuaW1wb3J0ICogYXMgWExTWCBmcm9tICd4bHN4JztcclxuLy8gaW1wb3J0IEhUTUx0b0RPQ1ggZnJvbSAnaHRtbC10by1kb2N4JztcclxuaW1wb3J0IGh0bWwycGRmIGZyb20gJ2h0bWwycGRmLmpzJztcclxud2luZG93WydodG1sMmNhbnZhcyddID0gaHRtbDJjYW52YXM7XHJcblxyXG5ASW5qZWN0YWJsZSgpXHJcbmV4cG9ydCBjbGFzcyBFeHBvcnRBc1NlcnZpY2Uge1xyXG5cclxuICBjb25zdHJ1Y3RvcigpIHsgfVxyXG5cclxuICAvKipcclxuICAgKiBNYWluIGJhc2U2NCBnZXQgbWV0aG9kLCBpdCB3aWxsIHJldHVybiB0aGUgZmlsZSBhcyBiYXNlNjQgc3RyaW5nXHJcbiAgICogQHBhcmFtIGNvbmZpZyB5b3VyIGNvbmZpZ1xyXG4gICAqL1xyXG4gIGdldChjb25maWc6IEV4cG9ydEFzQ29uZmlnKTogT2JzZXJ2YWJsZTxzdHJpbmcgfCBudWxsPiB7XHJcbiAgICAvLyBzdHJ1Y3R1cmUgbWV0aG9kIG5hbWUgZHluYW1pY2FsbHkgYnkgdHlwZVxyXG4gICAgY29uc3QgZnVuYyA9ICdnZXQnICsgY29uZmlnLnR5cGUudG9VcHBlckNhc2UoKTtcclxuICAgIC8vIGlmIHR5cGUgc3VwcG9ydGVkIGV4ZWN1dGUgYW5kIHJldHVyblxyXG4gICAgaWYgKHRoaXNbZnVuY10pIHtcclxuICAgICAgcmV0dXJuIHRoaXNbZnVuY10oY29uZmlnKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyB0aHJvdyBlcnJvciBmb3IgdW5zdXBwb3J0ZWQgZm9ybWF0c1xyXG4gICAgcmV0dXJuIG5ldyBPYnNlcnZhYmxlKChvYnNlcnZlcikgPT4geyBvYnNlcnZlci5lcnJvcignRXhwb3J0IHR5cGUgaXMgbm90IHN1cHBvcnRlZC4nKTsgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTYXZlIGV4cG9ydGVkIGZpbGUgaW4gb2xkIGphdmFzY3JpcHQgd2F5XHJcbiAgICogQHBhcmFtIGNvbmZpZyB5b3VyIGN1c3RvbSBjb25maWdcclxuICAgKiBAcGFyYW0gZmlsZU5hbWUgTmFtZSBvZiB0aGUgZmlsZSB0byBiZSBzYXZlZCBhc1xyXG4gICAqL1xyXG4gIHNhdmUoY29uZmlnOiBFeHBvcnRBc0NvbmZpZywgZmlsZU5hbWU6IHN0cmluZyk6IE9ic2VydmFibGU8c3RyaW5nIHwgbnVsbD4ge1xyXG4gICAgLy8gc2V0IGRvd25sb2FkXHJcbiAgICBjb25maWcuZG93bmxvYWQgPSB0cnVlO1xyXG4gICAgLy8gZ2V0IGZpbGUgbmFtZSB3aXRoIHR5cGVcclxuICAgIGNvbmZpZy5maWxlTmFtZSA9IGZpbGVOYW1lICsgJy4nICsgY29uZmlnLnR5cGU7XHJcbiAgICByZXR1cm4gdGhpcy5nZXQoY29uZmlnKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENvbnZlcnRzIGNvbnRlbnQgc3RyaW5nIHRvIGJsb2Igb2JqZWN0XHJcbiAgICogQHBhcmFtIGNvbnRlbnQgc3RyaW5nIHRvIGJlIGNvbnZlcnRlZFxyXG4gICAqL1xyXG4gIGNvbnRlbnRUb0Jsb2IoY29udGVudDogc3RyaW5nKTogT2JzZXJ2YWJsZTxCbG9iPiB7XHJcbiAgICByZXR1cm4gbmV3IE9ic2VydmFibGUoKG9ic2VydmVyKSA9PiB7XHJcbiAgICAgIC8vIGdldCBjb250ZW50IHN0cmluZyBhbmQgZXh0cmFjdCBtaW1lIHR5cGVcclxuICAgICAgY29uc3QgYXJyID0gY29udGVudC5zcGxpdCgnLCcpLCBtaW1lID0gYXJyWzBdLm1hdGNoKC86KC4qPyk7LylbMV0sXHJcbiAgICAgICAgYnN0ciA9IGF0b2IoYXJyWzFdKTtcclxuICAgICAgbGV0IG4gPSBic3RyLmxlbmd0aDtcclxuICAgICAgY29uc3QgdThhcnIgPSBuZXcgVWludDhBcnJheShuKTtcclxuICAgICAgd2hpbGUgKG4tLSkge1xyXG4gICAgICAgIHU4YXJyW25dID0gYnN0ci5jaGFyQ29kZUF0KG4pO1xyXG4gICAgICB9XHJcbiAgICAgIG9ic2VydmVyLm5leHQobmV3IEJsb2IoW3U4YXJyXSwgeyB0eXBlOiBtaW1lIH0pKTtcclxuICAgICAgb2JzZXJ2ZXIuY29tcGxldGUoKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVtb3ZlcyBiYXNlNjQgZmlsZSB0eXBlIGZyb20gYSBzdHJpbmcgbGlrZSBcImRhdGE6dGV4dC9jc3Y7YmFzZTY0LFwiXHJcbiAgICogQHBhcmFtIGZpbGVDb250ZW50IHRoZSBiYXNlNjQgc3RyaW5nIHRvIHJlbW92ZSB0aGUgdHlwZSBmcm9tXHJcbiAgICovXHJcbiAgcmVtb3ZlRmlsZVR5cGVGcm9tQmFzZTY0KGZpbGVDb250ZW50OiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgcmUgPSAvXmRhdGE6W15dKjtiYXNlNjQsL2c7XHJcbiAgICBjb25zdCBuZXdDb250ZW50OiBzdHJpbmcgPSByZVtTeW1ib2wucmVwbGFjZV0oZmlsZUNvbnRlbnQsICcnKTtcclxuICAgIHJldHVybiBuZXdDb250ZW50O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU3RydWN0dXJlIHRoZSBiYXNlNjQgZmlsZSBjb250ZW50IHdpdGggdGhlIGZpbGUgdHlwZSBzdHJpbmdcclxuICAgKiBAcGFyYW0gZmlsZUNvbnRlbnQgZmlsZSBjb250ZW50XHJcbiAgICogQHBhcmFtIGZpbGVNaW1lIGZpbGUgbWltZSB0eXBlIFwidGV4dC9jc3ZcIlxyXG4gICAqL1xyXG4gIGFkZEZpbGVUeXBlVG9CYXNlNjQoZmlsZUNvbnRlbnQ6IHN0cmluZywgZmlsZU1pbWU6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gYGRhdGE6JHtmaWxlTWltZX07YmFzZTY0LCR7ZmlsZUNvbnRlbnR9YDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIGNyZWF0ZSBkb3dubG9hZGFibGUgZmlsZSBmcm9tIGRhdGFVUkxcclxuICAgKiBAcGFyYW0gZmlsZU5hbWUgZG93bmxvYWRhYmxlIGZpbGUgbmFtZVxyXG4gICAqIEBwYXJhbSBkYXRhVVJMIGZpbGUgY29udGVudCBhcyBkYXRhVVJMXHJcbiAgICovXHJcbiAgZG93bmxvYWRGcm9tRGF0YVVSTChmaWxlTmFtZTogc3RyaW5nLCBkYXRhVVJMOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIC8vIGNyZWF0ZSBibG9iXHJcbiAgICB0aGlzLmNvbnRlbnRUb0Jsb2IoZGF0YVVSTCkuc3Vic2NyaWJlKGJsb2IgPT4ge1xyXG4gICAgICAvLyBkb3dubG9hZCB0aGUgYmxvYlxyXG4gICAgICB0aGlzLmRvd25sb2FkRnJvbUJsb2IoYmxvYiwgZmlsZU5hbWUpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEb3dubG9hZHMgdGhlIGJsb2Igb2JqZWN0IGFzIGEgZmlsZVxyXG4gICAqIEBwYXJhbSBibG9iIGZpbGUgb2JqZWN0IGFzIGJsb2JcclxuICAgKiBAcGFyYW0gZmlsZU5hbWUgZG93bmxvYWRhYmxlIGZpbGUgbmFtZVxyXG4gICAqL1xyXG4gIGRvd25sb2FkRnJvbUJsb2IoYmxvYjogQmxvYiwgZmlsZU5hbWU6IHN0cmluZykge1xyXG4gICAgLy8gZ2V0IG9iamVjdCB1cmxcclxuICAgIGNvbnN0IHVybCA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpO1xyXG4gICAgLy8gY2hlY2sgZm9yIG1pY3Jvc29mdCBpbnRlcm5ldCBleHBsb3JlclxyXG4gICAgaWYgKHdpbmRvdy5uYXZpZ2F0b3IgJiYgd2luZG93Lm5hdmlnYXRvci5tc1NhdmVPck9wZW5CbG9iKSB7XHJcbiAgICAgIC8vIHVzZSBJRSBkb3dubG9hZCBvciBvcGVuIGlmIHRoZSB1c2VyIHVzaW5nIElFXHJcbiAgICAgIHdpbmRvdy5uYXZpZ2F0b3IubXNTYXZlT3JPcGVuQmxvYihibG9iLCBmaWxlTmFtZSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLnNhdmVGaWxlKGZpbGVOYW1lLCB1cmwpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzYXZlRmlsZShmaWxlTmFtZTogc3RyaW5nLCB1cmw6IHN0cmluZykge1xyXG4gICAgLy8gaWYgbm90IHVzaW5nIElFIHRoZW4gY3JlYXRlIGxpbmsgZWxlbWVudFxyXG4gICAgY29uc3QgZWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcclxuICAgIC8vIHNldCBkb3dubG9hZCBhdHRyIHdpdGggZmlsZSBuYW1lXHJcbiAgICBlbGVtZW50LnNldEF0dHJpYnV0ZSgnZG93bmxvYWQnLCBmaWxlTmFtZSk7XHJcbiAgICAvLyBzZXQgdGhlIGVsZW1lbnQgYXMgaGlkZGVuXHJcbiAgICBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XHJcbiAgICAvLyBhcHBlbmQgdGhlIGJvZHlcclxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZWxlbWVudCk7XHJcbiAgICAvLyBzZXQgaHJlZiBhdHRyXHJcbiAgICBlbGVtZW50LmhyZWYgPSB1cmw7XHJcbiAgICAvLyBjbGljayBvbiBpdCB0byBzdGFydCBkb3dubG9hZGluZ1xyXG4gICAgZWxlbWVudC5jbGljaygpO1xyXG4gICAgLy8gcmVtb3ZlIHRoZSBsaW5rIGZyb20gdGhlIGRvbVxyXG4gICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChlbGVtZW50KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0UERGKGNvbmZpZzogRXhwb3J0QXNDb25maWcpOiBPYnNlcnZhYmxlPHN0cmluZyB8IG51bGw+IHtcclxuICAgIHJldHVybiBuZXcgT2JzZXJ2YWJsZSgob2JzZXJ2ZXIpID0+IHtcclxuICAgICAgaWYgKCFjb25maWcub3B0aW9ucykge1xyXG4gICAgICAgIGNvbmZpZy5vcHRpb25zID0ge307XHJcbiAgICAgIH1cclxuICAgICAgY29uZmlnLm9wdGlvbnMuZmlsZW5hbWUgPSBjb25maWcuZmlsZU5hbWU7XHJcbiAgICAgIGNvbnN0IGVsZW1lbnQ6IEhUTUxFbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoY29uZmlnLmVsZW1lbnRJZE9yQ29udGVudCk7XHJcbiAgICAgIGNvbnN0IHBkZiA9IGh0bWwycGRmKCkuc2V0KGNvbmZpZy5vcHRpb25zKS5mcm9tKGVsZW1lbnQgPyBlbGVtZW50IDogY29uZmlnLmVsZW1lbnRJZE9yQ29udGVudCk7XHJcblxyXG4gICAgICBjb25zdCBkb3dubG9hZCA9IGNvbmZpZy5kb3dubG9hZDtcclxuICAgICAgY29uc3QgcGRmQ2FsbGJhY2tGbiA9IGNvbmZpZy5vcHRpb25zLnBkZkNhbGxiYWNrRm47XHJcbiAgICAgIGlmIChkb3dubG9hZCkge1xyXG4gICAgICAgIGlmIChwZGZDYWxsYmFja0ZuKSB7XHJcbiAgICAgICAgICB0aGlzLmFwcGx5UGRmQ2FsbGJhY2tGbihwZGYsIHBkZkNhbGxiYWNrRm4pLnNhdmUoKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgcGRmLnNhdmUoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgb2JzZXJ2ZXIubmV4dCgpO1xyXG4gICAgICAgIG9ic2VydmVyLmNvbXBsZXRlKCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgaWYgKHBkZkNhbGxiYWNrRm4pIHtcclxuICAgICAgICAgIHRoaXMuYXBwbHlQZGZDYWxsYmFja0ZuKHBkZiwgcGRmQ2FsbGJhY2tGbikub3V0cHV0UGRmKCdkYXRhdXJpc3RyaW5nJykudGhlbihkYXRhID0+IHtcclxuICAgICAgICAgICAgb2JzZXJ2ZXIubmV4dChkYXRhKTtcclxuICAgICAgICAgICAgb2JzZXJ2ZXIuY29tcGxldGUoKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBwZGYub3V0cHV0UGRmKCdkYXRhdXJpc3RyaW5nJykudGhlbihkYXRhID0+IHtcclxuICAgICAgICAgICAgb2JzZXJ2ZXIubmV4dChkYXRhKTtcclxuICAgICAgICAgICAgb2JzZXJ2ZXIuY29tcGxldGUoKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFwcGx5UGRmQ2FsbGJhY2tGbihwZGYsIHBkZkNhbGxiYWNrRm4pIHtcclxuICAgIHJldHVybiBwZGYudG9QZGYoKS5nZXQoJ3BkZicpLnRoZW4oKHBkZlJlZikgPT4ge1xyXG4gICAgICBwZGZDYWxsYmFja0ZuKHBkZlJlZik7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0UE5HKGNvbmZpZzogRXhwb3J0QXNDb25maWcpOiBPYnNlcnZhYmxlPHN0cmluZyB8IG51bGw+IHtcclxuICAgIHJldHVybiBuZXcgT2JzZXJ2YWJsZSgob2JzZXJ2ZXIpID0+IHtcclxuICAgICAgY29uc3QgZWxlbWVudDogSFRNTEVsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChjb25maWcuZWxlbWVudElkT3JDb250ZW50KTtcclxuICAgICAgaHRtbDJjYW52YXMoZWxlbWVudCwgY29uZmlnLm9wdGlvbnMpLnRoZW4oKGNhbnZhcykgPT4ge1xyXG4gICAgICAgIGNvbnN0IGltZ0RhdGEgPSBjYW52YXMudG9EYXRhVVJMKCdpbWFnZS9QTkcnKTtcclxuICAgICAgICBpZiAoY29uZmlnLnR5cGUgPT09ICdwbmcnICYmIGNvbmZpZy5kb3dubG9hZCkge1xyXG4gICAgICAgICAgdGhpcy5kb3dubG9hZEZyb21EYXRhVVJMKGNvbmZpZy5maWxlTmFtZSwgaW1nRGF0YSk7XHJcbiAgICAgICAgICBvYnNlcnZlci5uZXh0KCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIG9ic2VydmVyLm5leHQoaW1nRGF0YSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIG9ic2VydmVyLmNvbXBsZXRlKCk7XHJcbiAgICAgIH0sIGVyciA9PiB7XHJcbiAgICAgICAgb2JzZXJ2ZXIuZXJyb3IoZXJyKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0Q1NWKGNvbmZpZzogRXhwb3J0QXNDb25maWcpOiBPYnNlcnZhYmxlPHN0cmluZyB8IG51bGw+IHtcclxuICAgIHJldHVybiBuZXcgT2JzZXJ2YWJsZSgob2JzZXJ2ZXIpID0+IHtcclxuICAgICAgY29uc3QgZWxlbWVudDogSFRNTEVsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChjb25maWcuZWxlbWVudElkT3JDb250ZW50KTtcclxuICAgICAgY29uc3QgY3N2ID0gW107XHJcbiAgICAgIGNvbnN0IHJvd3M6IGFueSA9IGVsZW1lbnQucXVlcnlTZWxlY3RvckFsbCgndGFibGUgdHInKTtcclxuICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHJvd3MubGVuZ3RoOyBpbmRleCsrKSB7XHJcbiAgICAgICAgY29uc3Qgcm93RWxlbWVudCA9IHJvd3NbaW5kZXhdO1xyXG4gICAgICAgIGNvbnN0IHJvdyA9IFtdO1xyXG4gICAgICAgIGNvbnN0IGNvbHMgPSByb3dFbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ3RkLCB0aCcpO1xyXG4gICAgICAgIGZvciAobGV0IGNvbEluZGV4ID0gMDsgY29sSW5kZXggPCBjb2xzLmxlbmd0aDsgY29sSW5kZXgrKykge1xyXG4gICAgICAgICAgY29uc3QgY29sID0gY29sc1tjb2xJbmRleF07XHJcbiAgICAgICAgICByb3cucHVzaChjb2wuaW5uZXJUZXh0KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY3N2LnB1c2gocm93LmpvaW4oJywnKSk7XHJcbiAgICAgIH1cclxuICAgICAgY29uc3QgY3N2Q29udGVudCA9ICdkYXRhOnRleHQvY3N2O2Jhc2U2NCwnICsgdGhpcy5idG9hKGNzdi5qb2luKCdcXG4nKSk7XHJcbiAgICAgIGlmIChjb25maWcuZG93bmxvYWQpIHtcclxuICAgICAgICB0aGlzLmRvd25sb2FkRnJvbURhdGFVUkwoY29uZmlnLmZpbGVOYW1lLCBjc3ZDb250ZW50KTtcclxuICAgICAgICBvYnNlcnZlci5uZXh0KCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgb2JzZXJ2ZXIubmV4dChjc3ZDb250ZW50KTtcclxuICAgICAgfVxyXG4gICAgICBvYnNlcnZlci5jb21wbGV0ZSgpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldFRYVChjb25maWc6IEV4cG9ydEFzQ29uZmlnKTogT2JzZXJ2YWJsZTxzdHJpbmcgfCBudWxsPiB7XHJcbiAgICBjb25zdCBuYW1lRnJhZ3MgPSBjb25maWcuZmlsZU5hbWUuc3BsaXQoJy4nKTtcclxuICAgIGNvbmZpZy5maWxlTmFtZSA9IGAke25hbWVGcmFnc1swXX0udHh0YDtcclxuICAgIHJldHVybiB0aGlzLmdldENTVihjb25maWcpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRYTFMoY29uZmlnOiBFeHBvcnRBc0NvbmZpZyk6IE9ic2VydmFibGU8c3RyaW5nIHwgbnVsbD4ge1xyXG4gICAgcmV0dXJuIG5ldyBPYnNlcnZhYmxlKChvYnNlcnZlcikgPT4ge1xyXG5cclxuICAgICAgY29uc3QgZWxlbWVudDogSFRNTEVsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChjb25maWcuZWxlbWVudElkT3JDb250ZW50KTtcclxuICAgICAgY29uc3Qgd3MzID0gWExTWC51dGlscy50YWJsZV90b19zaGVldChlbGVtZW50LCBjb25maWcub3B0aW9ucyk7XHJcbiAgICAgIGNvbnN0IHdiID0gWExTWC51dGlscy5ib29rX25ldygpO1xyXG4gICAgICBYTFNYLnV0aWxzLmJvb2tfYXBwZW5kX3NoZWV0KHdiLCB3czMsIGNvbmZpZy5maWxlTmFtZSk7XHJcbiAgICAgIGNvbnN0IG91dCA9IFhMU1gud3JpdGUod2IsIHsgdHlwZTogJ2Jhc2U2NCcgfSk7XHJcbiAgICAgIGNvbnN0IHhsc0NvbnRlbnQgPSAnZGF0YTphcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQuc3ByZWFkc2hlZXRtbC5zaGVldDtiYXNlNjQsJyArIG91dDtcclxuICAgICAgaWYgKGNvbmZpZy5kb3dubG9hZCkge1xyXG4gICAgICAgIHRoaXMuZG93bmxvYWRGcm9tRGF0YVVSTChjb25maWcuZmlsZU5hbWUsIHhsc0NvbnRlbnQpO1xyXG4gICAgICAgIG9ic2VydmVyLm5leHQoKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBvYnNlcnZlci5uZXh0KHhsc0NvbnRlbnQpO1xyXG4gICAgICB9XHJcbiAgICAgIG9ic2VydmVyLmNvbXBsZXRlKCk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0WExTWChjb25maWc6IEV4cG9ydEFzQ29uZmlnKTogT2JzZXJ2YWJsZTxzdHJpbmcgfCBudWxsPiB7XHJcbiAgICByZXR1cm4gdGhpcy5nZXRYTFMoY29uZmlnKTtcclxuICB9XHJcblxyXG4gIC8vIHByaXZhdGUgZ2V0RE9DWChjb25maWc6IEV4cG9ydEFzQ29uZmlnKTogT2JzZXJ2YWJsZTxzdHJpbmcgfCBudWxsPiB7XHJcbiAgLy8gICByZXR1cm4gbmV3IE9ic2VydmFibGUoKG9ic2VydmVyKSA9PiB7XHJcbiAgLy8gICAgIGNvbnN0IGNvbnRlbnREb2N1bWVudDogc3RyaW5nID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoY29uZmlnLmVsZW1lbnRJZE9yQ29udGVudCkub3V0ZXJIVE1MO1xyXG4gIC8vICAgICBjb25zdCBjb250ZW50ID0gJzwhRE9DVFlQRSBodG1sPicgKyBjb250ZW50RG9jdW1lbnQ7XHJcbiAgLy8gICAgIEhUTUx0b0RPQ1goY29udGVudCwgbnVsbCwgY29uZmlnLm9wdGlvbnMpLnRoZW4oY29udmVydGVkID0+IHtcclxuICAvLyAgICAgICBpZiAoY29uZmlnLmRvd25sb2FkKSB7XHJcbiAgLy8gICAgICAgICBjb25zdCBibG9iID0gbmV3IEJsb2IoW2NvbnZlcnRlZF0pO1xyXG4gIC8vICAgICAgICAgdGhpcy5kb3dubG9hZEZyb21CbG9iKGNvbnZlcnRlZCwgY29uZmlnLmZpbGVOYW1lKTtcclxuICAvLyAgICAgICAgIG9ic2VydmVyLm5leHQoKTtcclxuICAvLyAgICAgICAgIG9ic2VydmVyLmNvbXBsZXRlKCk7XHJcbiAgLy8gICAgICAgfSBlbHNlIHtcclxuICAvLyAgICAgICAgIGNvbnN0IHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XHJcbiAgLy8gICAgICAgICByZWFkZXIub25sb2FkZW5kID0gKCkgPT4ge1xyXG4gIC8vICAgICAgICAgICBjb25zdCBiYXNlNjRkYXRhID0gcmVhZGVyLnJlc3VsdCBhcyBzdHJpbmc7XHJcbiAgLy8gICAgICAgICAgIG9ic2VydmVyLm5leHQoYmFzZTY0ZGF0YSk7XHJcbiAgLy8gICAgICAgICAgIG9ic2VydmVyLmNvbXBsZXRlKCk7XHJcbiAgLy8gICAgICAgICB9O1xyXG4gIC8vICAgICAgICAgcmVhZGVyLnJlYWRBc0RhdGFVUkwoY29udmVydGVkKTtcclxuICAvLyAgICAgICB9XHJcbiAgLy8gICAgIH0pO1xyXG4gIC8vICAgfSk7XHJcbiAgLy8gfVxyXG5cclxuICAvLyBwcml2YXRlIGdldERPQyhjb25maWc6IEV4cG9ydEFzQ29uZmlnKTogT2JzZXJ2YWJsZTxzdHJpbmcgfCBudWxsPiB7XHJcbiAgLy8gICByZXR1cm4gdGhpcy5nZXRET0NYKGNvbmZpZyk7XHJcbiAgLy8gfVxyXG5cclxuICBwcml2YXRlIGdldEpTT04oY29uZmlnOiBFeHBvcnRBc0NvbmZpZyk6IE9ic2VydmFibGU8YW55W10gfCBudWxsPiB7XHJcbiAgICByZXR1cm4gbmV3IE9ic2VydmFibGUoKG9ic2VydmVyKSA9PiB7XHJcbiAgICAgIGNvbnN0IGRhdGEgPSBbXTsgLy8gZmlyc3Qgcm93IG5lZWRzIHRvIGJlIGhlYWRlcnNcclxuICAgICAgY29uc3QgaGVhZGVycyA9IFtdO1xyXG4gICAgICBjb25zdCB0YWJsZSA9IDxIVE1MVGFibGVFbGVtZW50PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGNvbmZpZy5lbGVtZW50SWRPckNvbnRlbnQpO1xyXG4gICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgdGFibGUucm93c1swXS5jZWxscy5sZW5ndGg7IGluZGV4KyspIHtcclxuICAgICAgICBoZWFkZXJzW2luZGV4XSA9IHRhYmxlLnJvd3NbMF0uY2VsbHNbaW5kZXhdLmlubmVySFRNTC50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoLyAvZ2ksICcnKTtcclxuICAgICAgfVxyXG4gICAgICAvLyBnbyB0aHJvdWdoIGNlbGxzXHJcbiAgICAgIGZvciAobGV0IGkgPSAxOyBpIDwgdGFibGUucm93cy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIGNvbnN0IHRhYmxlUm93ID0gdGFibGUucm93c1tpXTsgY29uc3Qgcm93RGF0YSA9IHt9O1xyXG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgdGFibGVSb3cuY2VsbHMubGVuZ3RoOyBqKyspIHtcclxuICAgICAgICAgIHJvd0RhdGFbaGVhZGVyc1tqXV0gPSB0YWJsZVJvdy5jZWxsc1tqXS5pbm5lckhUTUw7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGRhdGEucHVzaChyb3dEYXRhKTtcclxuICAgICAgfVxyXG4gICAgICBjb25zdCBqc29uU3RyaW5nID0gSlNPTi5zdHJpbmdpZnkoZGF0YSk7XHJcbiAgICAgIGNvbnN0IGpzb25CYXNlNjQgPSB0aGlzLmJ0b2EoanNvblN0cmluZyk7XHJcbiAgICAgIGNvbnN0IGRhdGFTdHIgPSAnZGF0YTp0ZXh0L2pzb247YmFzZTY0LCcgKyBqc29uQmFzZTY0O1xyXG4gICAgICBpZiAoY29uZmlnLmRvd25sb2FkKSB7XHJcbiAgICAgICAgdGhpcy5kb3dubG9hZEZyb21EYXRhVVJMKGNvbmZpZy5maWxlTmFtZSwgZGF0YVN0cik7XHJcbiAgICAgICAgb2JzZXJ2ZXIubmV4dCgpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIG9ic2VydmVyLm5leHQoZGF0YSk7XHJcbiAgICAgIH1cclxuICAgICAgb2JzZXJ2ZXIuY29tcGxldGUoKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRYTUwoY29uZmlnOiBFeHBvcnRBc0NvbmZpZyk6IE9ic2VydmFibGU8c3RyaW5nIHwgbnVsbD4ge1xyXG4gICAgcmV0dXJuIG5ldyBPYnNlcnZhYmxlKChvYnNlcnZlcikgPT4ge1xyXG4gICAgICBsZXQgeG1sID0gJzw/eG1sIHZlcnNpb249XCIxLjBcIiBlbmNvZGluZz1cIlVURi04XCI/PjxSb290PjxDbGFzc2VzPic7XHJcbiAgICAgIGNvbnN0IHRyaXRlbSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGNvbmZpZy5lbGVtZW50SWRPckNvbnRlbnQpLmdldEVsZW1lbnRzQnlUYWdOYW1lKCd0cicpO1xyXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRyaXRlbS5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIGNvbnN0IGNlbGxkYXRhID0gdHJpdGVtW2ldO1xyXG4gICAgICAgIGlmIChjZWxsZGF0YS5jZWxscy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICB4bWwgKz0gJzxDbGFzcyBuYW1lPVwiJyArIGNlbGxkYXRhLmNlbGxzWzBdLnRleHRDb250ZW50ICsgJ1wiPlxcbic7XHJcbiAgICAgICAgICBmb3IgKGxldCBtID0gMTsgbSA8IGNlbGxkYXRhLmNlbGxzLmxlbmd0aDsgKyttKSB7XHJcbiAgICAgICAgICAgIHhtbCArPSAnXFx0PGRhdGE+JyArIGNlbGxkYXRhLmNlbGxzW21dLnRleHRDb250ZW50ICsgJzwvZGF0YT5cXG4nO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgeG1sICs9ICc8L0NsYXNzPlxcbic7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHhtbCArPSAnPC9DbGFzc2VzPjwvUm9vdD4nO1xyXG4gICAgICBjb25zdCBiYXNlNjQgPSAnZGF0YTp0ZXh0L3htbDtiYXNlNjQsJyArIHRoaXMuYnRvYSh4bWwpO1xyXG4gICAgICBpZiAoY29uZmlnLmRvd25sb2FkKSB7XHJcbiAgICAgICAgdGhpcy5kb3dubG9hZEZyb21EYXRhVVJMKGNvbmZpZy5maWxlTmFtZSwgYmFzZTY0KTtcclxuICAgICAgICBvYnNlcnZlci5uZXh0KCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgb2JzZXJ2ZXIubmV4dChiYXNlNjQpO1xyXG4gICAgICB9XHJcbiAgICAgIG9ic2VydmVyLmNvbXBsZXRlKCk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYnRvYShjb250ZW50OiBzdHJpbmcpIHtcclxuICAgIHJldHVybiBidG9hKHVuZXNjYXBlKGVuY29kZVVSSUNvbXBvbmVudChjb250ZW50KSkpO1xyXG4gIH1cclxuXHJcbn1cclxuIl19