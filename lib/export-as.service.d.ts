import { Observable } from 'rxjs';
import { ExportAsConfig } from './export-as-config.model';
import * as ɵngcc0 from '@angular/core';
export declare class ExportAsService {
    constructor();
    /**
     * Main base64 get method, it will return the file as base64 string
     * @param config your config
     */
    get(config: ExportAsConfig): Observable<string | null>;
    /**
     * Save exported file in old javascript way
     * @param config your custom config
     * @param fileName Name of the file to be saved as
     */
    save(config: ExportAsConfig, fileName: string): Observable<string | null>;
    /**
     * Converts content string to blob object
     * @param content string to be converted
     */
    contentToBlob(content: string): Observable<Blob>;
    /**
     * Removes base64 file type from a string like "data:text/csv;base64,"
     * @param fileContent the base64 string to remove the type from
     */
    removeFileTypeFromBase64(fileContent: string): string;
    /**
     * Structure the base64 file content with the file type string
     * @param fileContent file content
     * @param fileMime file mime type "text/csv"
     */
    addFileTypeToBase64(fileContent: string, fileMime: string): string;
    /**
     * create downloadable file from dataURL
     * @param fileName downloadable file name
     * @param dataURL file content as dataURL
     */
    downloadFromDataURL(fileName: string, dataURL: string): void;
    /**
     * Downloads the blob object as a file
     * @param blob file object as blob
     * @param fileName downloadable file name
     */
    downloadFromBlob(blob: Blob, fileName: string): void;
    private saveFile;
    private getPDF;
    private applyPdfCallbackFn;
    private getPNG;
    private getCSV;
    private getTXT;
    private getXLS;
    private getXLSX;
    private getJSON;
    private getXML;
    private btoa;
    static ɵfac: ɵngcc0.ɵɵFactoryDeclaration<ExportAsService, never>;
    static ɵprov: ɵngcc0.ɵɵInjectableDeclaration<ExportAsService>;
}

//# sourceMappingURL=export-as.service.d.ts.map