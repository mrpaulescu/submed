/*
 * SubMed shared organic chemistry library.
 * The same records power the IUPAC quiz and Lewis Builder.
 * SMILES are canonicalized only for display/graph exercises; review this teaching
 * dataset against the current faculty bibliography before treating it as exhaustive.
 */
(() => {
  const compounds = [];
  const seen = new Set();
  const roots = ["","met","et","prop","but","pent","hex","hept","oct","non","dec","undec","dodec","tridec","tetradec","pentadec","hexadec","heptadec","octadec","nonadec","eicos","henicos","docos","tricos","tetracos","pentacos","hexacos","heptacos","octacos","nonacos","triacont","hentriacont","dotriacont","tritriacont"];
  const root = n => roots[n] || ("C"+n);
  const add = (smiles,iupacRo,commonRo,category,aliasesRo=[]) => {
    if (seen.has(category+"|"+smiles)) return;
    seen.add(category+"|"+smiles);
    compounds.push({smiles,iupacRo,commonRo:commonRo||iupacRo,aliasesRo,category});
  };
  const alkaneName = n => root(n)+"an";
  const alkeneName = (n,p=1) => root(n)+"-"+p+"-enă";
  const alkyneName = (n,p=1) => root(n)+"-"+p+"-ină";
  const acidName = n => "acid "+root(n)+"anoic";
  const prefixes = ["","metil","etil","propil","butil","pentil","hexil","heptil","octil","nonil","decil","undecil","dodecil","tridecil","tetradecil","pentadecil","hexadecil","heptadecil","octadecil","nonadecil","eicosil","henicosil","docosil","tricosil","tetracosil","pentacosil","hexacosil","heptacosil","octacosil","nonacosil","triacontil"];

  // 1. Alcani: 20 membri liniari + 10 izomeri ramificați.
  for(let n=1;n<=20;n++) add("C".repeat(n),alkaneName(n),null,"alcani");
  [
    ["CC(C)C","2-metilpropan","izobutan"],
    ["CC(C)CC","2-metilbutan","izopentan"],
    ["CC(C)(C)C","2,2-dimetilpropan","neopentan"],
    ["CC(C)CCC","2-metilpentan",null],
    ["CCC(C)CC","3-metilpentan",null],
    ["CC(C)(C)CC","2,2-dimetilbutan",null],
    ["CC(C)C(C)C","2,3-dimetilbutan",null],
    ["CCC(C)(C)CC","3,3-dimetilpentan",null],
    ["CC(C)(C)C(C)C","2,2,3-trimetilbutan",null],
    ["CC(C)CCCC","2-metilhexan",null]
  ].forEach(x=>add(x[0],x[1],x[2],"alcani"));

  // 2. Alchene: alchene terminale și 2-alchene.
  for(let n=2;n<=20;n++) add("C="+"C".repeat(n-1),alkeneName(n,1),null,"alchene");
  for(let n=4;n<=14;n++) add("C".repeat(2)+"="+"C".repeat(n-2),alkeneName(n,2),null,"alchene");

  // 3. Alchine: alchine terminale și 2-alchine.
  for(let n=2;n<=20;n++) add("C#"+"C".repeat(n-1),alkyneName(n,1),null,"alchine");
  for(let n=4;n<=14;n++) add("C".repeat(2)+"#"+"C".repeat(n-2),alkyneName(n,2),null,"alchine");

  // 4. Arene: benzen și omologi alchilbenzenici.
  add("c1ccccc1","benzen","benzen","aromatici");
  for(let n=1;n<=29;n++){
    const name=(prefixes[n]||("alchil-"+n))+"benzen";
    add("C".repeat(n)+"c1ccccc1",name,null,"aromatici");
  }

  // 5. Derivați halogenați: cloroalcani și bromoalcani.
  for(let n=1;n<=15;n++){
    add("Cl"+"C".repeat(n),"1-cloro"+alkaneName(n),null,"halogenati");
    add("Br"+"C".repeat(n),"1-bromo"+alkaneName(n),null,"halogenati");
  }

  // 6. Alcooli: alcooli primari și secundari.
  for(let n=1;n<=15;n++) add("C".repeat(n)+"O",n===1?"metanol":n===2?"etanol":root(n)+"an-1-ol",null,"alcooli");
  for(let n=3;n<=17;n++) add("C"+"C(O)"+"C".repeat(n-2),root(n)+"an-2-ol",null,"alcooli");

  // 7. Fenoli: fenol și omologi para-alchil substituiți.
  add("Oc1ccccc1","benzenol","fenol","fenoli",["fenol"]);
  for(let n=1;n<=29;n++){
    const name=(n===1?"4-metil":n===2?"4-etil":"4-"+(prefixes[n]||"alchil"))+"fenol";
    add("C".repeat(n)+"c1ccc(O)cc1",name,null,"fenoli");
  }

  // 8. Amine primare alifatice.
  for(let n=1;n<=30;n++) add("C".repeat(n)+"N",n<=2?root(n)+"anamină":root(n)+"an-1-amină",null,"amine");

  // 9. Nitroderivați: omologi nitroalcani.
  for(let n=1;n<=30;n++) add("C".repeat(n)+"[N+](=O)[O-]",n===1?"nitrometan":n===2?"nitroetan":"1-nitro"+alkaneName(n),null,"nitroderivati");

  // 10. Aldehide și cetone.
  for(let n=1;n<=15;n++) add("C".repeat(n-1)+"C=O",root(n)+"anal",null,"carbonilici");
  for(let n=3;n<=17;n++) add("C"+"C(=O)"+"C".repeat(n-2),root(n)+"an-2-onă",null,"carbonilici");

  // 11. Acizi carboxilici alifatici.
  for(let n=1;n<=30;n++) add("C".repeat(n-1)+"C(=O)O",acidName(n),null,"carboxilici");

  // 12. Acizi grași: serie omoloagă C4-C33.
  for(let n=4;n<=33;n++) add("C".repeat(n-1)+"C(=O)O",acidName(n),"acid gras "+root(n),"acizi grasi");

  // 13. Derivați ai acizilor: esteri, amide și nitrili.
  for(let n=1;n<=10;n++){
    const acyl= n+1;
    add("C".repeat(n)+"OC(=O)C", "etanoat de "+(prefixes[n]||"alchil"),null,"derivati acizi");
  }
  for(let n=1;n<=10;n++) add("C".repeat(n-1)+"C(=O)N",root(n)+"anamidă",null,"derivati acizi");
  for(let n=1;n<=10;n++) add("C".repeat(n)+"C#N",root(n+1)+"anenitril",null,"derivati acizi");

  // 14. Aminoacizi: aminoacizi proteinogeni și aminoacizi neproteinogeni uzuali.
  [
    ["NCC(=O)O","acid 2-aminoetanoic","glicină"],
    ["CC(N)C(=O)O","acid 2-aminopropanoic","alanină"],
    ["CC(C)C(N)C(=O)O","acid 2-amino-3-metilbutanoic","valină"],
    ["CC(C)CC(N)C(=O)O","acid 2-amino-4-metilpentanoic","leucină"],
    ["CCC(C)C(N)C(=O)O","acid 2-amino-3-metilpentanoic","izoleucină"],
    ["NC(CO)C(=O)O","acid 2-amino-3-hidroxipropanoic","serină"],
    ["CC(O)C(N)C(=O)O","acid 2-amino-3-hidroxibutanoic","treonină"],
    ["NC(CS)C(=O)O","acid 2-amino-3-sulfanylpropanoic","cisteină"],
    ["CSCC(N)C(=O)O","acid 2-amino-4-(metilsulfanil)butanoic","metionină"],
    ["NC(CC1=CC=CC=C1)C(=O)O","acid 2-amino-3-fenilpropanoic","fenilalanină"],
    ["NC(CC1=CC=C(O)C=C1)C(=O)O","acid 2-amino-3-(4-hidroxifenil)propanoic","tirozină"],
    ["NC(CC1=CNC2=CC=CC=C12)C(=O)O","acid 2-amino-3-(1H-indol-3-il)propanoic","triptofan"],
    ["NC(CC(=O)O)C(=O)O","acid 2-aminobutandioic","acid aspartic"],
    ["NC(CCC(=O)O)C(=O)O","acid 2-aminopentandioic","acid glutamic"],
    ["NC(CC(N)=O)C(=O)O","acid 2,4-diamino-4-oxobutanoic","asparagină"],
    ["NC(CCC(N)=O)C(=O)O","acid 2,5-diamino-5-oxopentanoic","glutamină"],
    ["NCCCCC(N)C(=O)O","acid 2,6-diaminohexanoic","lizină"],
    ["NC(CCCNC(N)=N)C(=O)O","acid 2-amino-5-guanidinopentanoic","arginină"],
    ["N1CCCC1C(=O)O","acid pirolidin-2-carboxilic","prolină"],
    ["NC(CC1=CN=CN1)C(=O)O","acid 2-amino-3-(1H-imidazol-4-il)propanoic","histidină"],
    ["NCCC(=O)O","acid 3-aminopropanoic","beta-alanină"],
    ["NCCCC(=O)O","acid 4-aminobutanoic","acid gamma-aminobutiric"],
    ["CCC(N)C(=O)O","acid 2-aminobutanoic","acid alfa-aminobutiric"],
    ["NC(CCC)C(=O)O","acid 2-aminopentanoic","norvalină"],
    ["NC(CCCC)C(=O)O","acid 2-aminohexanoic","norleucină"],
    ["NC(CCO)C(=O)O","acid 2-amino-4-hidroxibutanoic","homoserină"],
    ["NC1CCC(O)C1C(=O)O","acid 4-hidroxipirolidin-2-carboxilic","hidroxiprolină"],
    ["CC(N)(C(=O)O)CC(=O)O","acid 2-amino-2-metilbutandioic","acid 2-metilaspartic"],
    ["NC(C)(C)C(=O)O","acid 2-amino-2-metilpropanoic","alfa-aminoisobutiric"],
    ["NC(CCS)C(=O)O","acid 2-amino-4-sulfanylbutanoic","homocisteină"]
  ].forEach(x=>add(x[0],x[1],x[2],"aminoacizi"));

  // 15. Zaharide: aldohexoze, aldopentoze și cetohexoze, inclusiv stereoizomeri.
  const hexoses=[
    ["glucoză","@","@@","@","@"],["mannoză","@@","@@","@","@"],
    ["galactoză","@","@@","@@","@"],["taloză","@@","@@","@@","@"],
    ["alloză","@","@","@","@"],["altroză","@@","@","@","@"],
    ["guloză","@","@","@@","@"],["idoză","@@","@","@@","@"]
  ];
  hexoses.forEach(([name,a,b,c,d])=>{
    const sm="O=C[C"+a+"H](O)[C"+b+"H](O)[C"+c+"H](O)[C"+d+"H](O)CO";
    add(sm,"aldohexoză ("+name+")","D-"+name,"zaharide",["d-"+name]);
    const inv=x=>x==="@"?"@@":"@";
    const mirror="O=C[C"+inv(a)+"H](O)[C"+inv(b)+"H](O)[C"+inv(c)+"H](O)[C"+inv(d)+"H](O)CO";
    add(mirror,"aldohexoză ("+name+" enantiomer)","L-"+name,"zaharide",["l-"+name]);
  });
  const pentoses=[["riboză","@","@","@"],["arabinoză","@@","@","@"],["xiloză","@","@@","@"],["lixoză","@@","@@","@"]];
  pentoses.forEach(([name,a,b,c])=>{
    const sm="O=C[C"+a+"H](O)[C"+b+"H](O)[C"+c+"H](O)CO";
    add(sm,"aldopentoză ("+name+")","D-"+name,"zaharide",["d-"+name]);
    const inv=x=>x==="@"?"@@":"@";
    add("O=C[C"+inv(a)+"H](O)[C"+inv(b)+"H](O)[C"+inv(c)+"H](O)CO","aldopentoză ("+name+" enantiomer)","L-"+name,"zaharide",["l-"+name]);
  });
  [
    ["fructoză","@","@@","@"],["psicoză","@","@","@"],["sorboză","@@","@@","@"],["tagatoză","@@","@","@"]
  ].forEach(([name,a,b,c])=>{
    const sm="OC[C"+a+"H](O)[C"+b+"H](O)[C"+c+"H](O)C(=O)CO";
    add(sm,"cetohexoză ("+name+")","D-"+name,"zaharide",["d-"+name]);
  });
  // Aldotetroze: două perechi de stereoizomeri.
  [["eritroză","@","@"],["treoză","@","@@"]].forEach(([name,a,b])=>{
    add("O=C[C"+a+"H](O)[C"+b+"H](O)CO","aldotetroză ("+name+")","D-"+name,"zaharide",["d-"+name]);
    const inv=x=>x==="@"?"@@":"@";
    add("O=C[C"+inv(a)+"H](O)[C"+inv(b)+"H](O)CO","aldotetroză ("+name+" enantiomer)","L-"+name,"zaharide",["l-"+name]);
  });

  const counts={};
  compounds.forEach(c=>counts[c.category]=(counts[c.category]||0)+1);
  window.ORGANIC_COMPOUNDS=compounds;
  window.UNIQUE_COMPOUNDS=compounds;
  window.SUBMED_COMPOUND_COUNTS=counts;
  if(typeof module!=="undefined"&&module.exports) module.exports={ORGANIC_COMPOUNDS:compounds,UNIQUE_COMPOUNDS:compounds,SUBMED_COMPOUND_COUNTS:counts};
})();