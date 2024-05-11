const $ = require("jquery");
const fs = require("fs");
// const dialog = require("electron").remote.dialog;

//without using remote, the renderer process desn't get access to dialog.
//Only main fn gets access to dialog in that case.
const { dialog } = require("electron").remote;


$(document).ready(function(){
    //address-container
    $(".grid .cell").on("click",function(){
        let rid = $(this).attr("row-id");
        let cid = Number($(this).attr("col-id"));
        let cAdd = String.fromCharCode(65 + cid);
        $("#address-container").val(cAdd+ rid);
    })

    /***********************Menu and Sub-Menu Options ***************************************************** */

    //menu handle
    $(".menu-options").on("click",function(){
        $(".sub-menu-options").removeClass("selected");
        let id = $(this).attr("id");
        $(`.${id}-options`).addClass("selected");
    })

    //New 
    let db = [];
    $("#New").click(function(){
        let rows = $(".grid").find(".row");
        for(let i=0;i<rows.length;i++){
            let row = [];
            let cells = $(rows[i]).find(".cell");
            for(let j=0;j<cells.length;j++){
                let cell = {
                    value: "",
                    formula:"",
                    downstream:[],
                    upstream:[]
                }
                $(cells[j]).html("");
                row.push(cell);
            }
            db.push(row);
        }
        console.log("New page opened");
    })

    //Save 
    let fileSaver = document.getElementById("Save");
    fileSaver.addEventListener("change",async function(){
        //changed -> when other file selected.
        let fPath = await fileSaver.files[0].path;
        let jsonData = JSON.stringify(db);
        fs.writeFileSync(fPath,jsonData);
        console.log("file written to disk");
    })

    //Open
    $("#Open").click(async function(){
        let dbox = await dialog.showOpenDialog();
        let fPath = dbox.filePaths[0];
        let content = await fs.promises.readFile(fPath);
        db = JSON.parse(content);
        let rows = $(".grid").find(".row");
        for(let i=0;i<rows.length;i++){
            let cells = $(rows[i]).find(".cell");
            for(let j=0;j<cells.length;j++){
                $(cells[j]).html(db[i][j].value);
            }
        }
        console.log("file opened successfully");
    })

    /******************************Formula Work ****************************************************************** */

    //Update db
    $(".grid .cell").on("blur",function(){
        //Update db whenever something entered in cell
        let rid = Number($(this).attr("row-id"))-1;
        let cid = Number($(this).attr("col-id"));
        //text and html both will work here.
        if(db[rid][cid].value == $(this).text()){
            //if value in database, and entered by the user are same, no need to do anything
            return; 
        } else {
            db[rid][cid].value = $(this).text(); //update in database
            updateCell(rid,cid);
            if(db[rid][cid].formula!=""){
                //remove old formula now
                removeFormula(rid,cid);
            }
            console.log("all cells updated due to modification in current cell.");
        }
        // console.log(db);
    })

    $("#formula-container").on("blur",function(){
        let address = $("#address-container").val();
        let formula = $(this).val();
        let {rowId,colId} = getRC(address); //rowId and colId are indices in database, not in UI.
        if(db[rowId][colId].formula == formula){
            return;
        }
        if(db[rowId][col].formula){
            //very important to remove old formula, otherwise it may create ambiguity in 
            //downstream and upstream arrays (so, very imp to update them.)
            removeFormula(rowId,colId);
        }
        db[rowId][colId].formula = formula;
        setUpFormula(formula,rowId,colId);
        evaluate(formula,rowId,colId);
        updateCell(rowId,colId);
        console.log("sara kaam done");
    })

    function setUpFormula(formula,rowId,colId){
        formulaElements = formula.split(" ");
        //formua -> [(,A1,A2,)];
        for(let i=0;i<formulaElements.length;i++){
            if(formulaElements[i].charAt(0)>='A' && formulaElements[i].charAt(0)<='Z'){
                let cellAddress = formulaElements[i];
                // let {cellRowId,cellColId} = getRC(cellAddress); --> this is very wrong
                let parent = getRC(cellAddress);
                db[parent.rowId][parent.colId].downstream.push({rowId,colId});
                let parentRowId = parent.rowId;
                let parentColId = parent.colId;
                db[rowId][colId].upstream.push({parentRowId,parentColId});
                //or you can push upstream as
                /*db[rowId][colId].upstream.push({
                    rowId:parentRowId,
                    colId:parentColId
                })*/
            }
        }
        console.log("formula setted up");
    }

    function evaluate(formula,rowId,colId){
        //e.g -> formula - ( A1 + A2 )
        formulaElements = formula.split(" "); // [ ( ,A1 , A2 , ) ]
        for(let i=0;i<formulaElements.length;i++){
            if(formulaElements[i].charAt(0)>='A' && formulaElements[i].charAt(0)<='Z'){
                let cellAddress = formulaElements[i]; //a component of formula -> e.g -> A1
                //A1 and A2 are parent of B1.
                let parent = getRC(cellAddress); //object containing indices of A1 in database.
                let parentRowId = parent.rowId;
                let parentColId = parent.colId;
                let cellValue = db[parentRowId][parentColId].value; // value property in db // cellValue -> 10
                formula = formula.replace(formulaElements[i],cellValue); // formula -> ( 10 + A2 )
            }
        }
        let answer = eval(formula); //it accepts string value
        db[rowId][colId].value = answer; //store answer in database.
        //put evaluated value in UI
        $(`.grid .cell[row-id=${rowId+1}][col-id=${colId}]`).html(answer);
        console.log("value evaluated");
        return answer;
    }

    function updateCell(rowId,colId){
        //update the value if it has any dependents.
        for(let i=0;i<db[rowId][colId].downstream.length;i++){
            let object = db[rowId][colId].downstream[i]; //it's dependent child's object
            let childRowId = object.rowId;
            let childColId = object.colId;
            //evaluate and update the dependent cells also, if the formula for previous cell is changed.
            newVal = evaluate(db[childRowId][childColId].formula,childRowId,childColId);
            updateCell(childRowId,childColId,newVal);
        }
        console.log("cells updated.");
    }

    function removeFormula(rowId,colId){
        //clear its formula
        db[rowId][colId].formula = "";
        //2. clear itself from its parent's downstream array
        //all its parents are stored in upstream array

        for(let i=0;i<db[rowId][colId].upstream.length;i++){
            let parent = db[rowId][colId].upstream[i];
            let parentRowId = parent.parentRowId; 
            //it can't be (parent.rowId), because upstream is stored as {parentRowId, parentColId}
            let parentColId = parent.parentColId;

            let filteredDownstream = db[parentRowId][parentColId].downstream.filter(function(obj){
                return (obj.rowId!=rowId && obj.colId!=colId);
            });
            db[parentRowId][parentColId].downstream = filteredDownstream;
        }
        //step 3 -> empty it's upstream array
        db[rowId][colId].upstream = [];
        console.log("formula removed");
    }

    //fn to return rowId and colId of a particular address
    //we can do it by sending this to the fn.
    function getRC(address){
        //this fn returns indexes according to the database 
        let colId = Number(address.charCodeAt(0))-65;
        let rowId = Number(address.charAt(1))-1;
        return {rowId,colId};
    }
    
    function init(){
        $("#File").click();
        $("#New").trigger("click");
    }
    init();
})

// ( A1 + A2 )