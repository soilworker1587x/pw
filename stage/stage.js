
import { loadSavedOrDemo } from './js/dataIO.js';
import { wireComposer, wireGlobalClicks, wireImport, wireSearch } from './js/handlers.js';


loadSavedOrDemo();

wireGlobalClicks();
wireImport();
wireSearch();
wireComposer();
