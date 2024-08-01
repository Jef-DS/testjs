// htmx.logger = function(elt, event, data) {
//     if(console) {
//         console.log(event, elt, data);
//     }
// }

function toggleBedrijf(showBedrijf=false){

}

htmx.onLoad((element) => {
    if (element.id === "inschrijvingsform"){
        const buttons = document.getElementsByName("inschrijvingsbutton");
        buttons.forEach(b => b.disabled = true);
        element.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'end' })
        element.addEventListener('reset', () => {
            const divEl = element.parentElement;
            divEl.removeChild(element);
            buttons.forEach(b => b.disabled = false);
        })
    }
})