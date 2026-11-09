/*
 * SubMed · IUPAC Quiz
 * Set de studiu organizat pe clase din tematicile de admitere la medicină.
 * Denumirile sunt în română; aliasurile includ nume uzuale și sinonime.
 * Lista este o selecție didactică de compuși reprezentativi, nu o listă oficială exhaustivă.
 */
const ORGANIC_COMPOUNDS = [
  // Hidrocarburi saturate
  {smiles:"C",iupacRo:"metan",commonRo:"metan",aliasesRo:["gaz de baltă"],category:"alcani"},
  {smiles:"CC",iupacRo:"etan",commonRo:"etan",aliasesRo:[],category:"alcani"},
  {smiles:"CCC",iupacRo:"propan",commonRo:"propan",aliasesRo:[],category:"alcani"},
  {smiles:"CCCC",iupacRo:"butan",commonRo:"butan",aliasesRo:[],category:"alcani"},
  {smiles:"CCCCC",iupacRo:"pentan",commonRo:"pentan",aliasesRo:[],category:"alcani"},
  {smiles:"CCCCCC",iupacRo:"hexan",commonRo:"hexan",aliasesRo:[],category:"alcani"},
  {smiles:"CCCCCCC",iupacRo:"heptan",commonRo:"heptan",aliasesRo:[],category:"alcani"},
  {smiles:"CCCCCCCC",iupacRo:"octan",commonRo:"octan",aliasesRo:[],category:"alcani"},
  {smiles:"CC(C)C",iupacRo:"2-metilpropan",commonRo:"izobutan",aliasesRo:["2-metilpropan","izobutan"],category:"alcani"},
  {smiles:"CC(C)CC",iupacRo:"2-metilbutan",commonRo:"izopentan",aliasesRo:["2-metilbutan","izopentan"],category:"alcani"},
  {smiles:"CC(C)(C)C",iupacRo:"2,2-dimetilpropan",commonRo:"neopentan",aliasesRo:["2,2-dimetilpropan","neopentan"],category:"alcani"},
  {smiles:"C1CCCCC1",iupacRo:"ciclohexan",commonRo:"ciclohexan",aliasesRo:[],category:"alcani"},

  // Alchene și alcadiene
  {smiles:"C=C",iupacRo:"etenă",commonRo:"etilenă",aliasesRo:["etenă","etilenă"],category:"alchene"},
  {smiles:"CC=C",iupacRo:"propenă",commonRo:"propilenă",aliasesRo:["propenă","propilenă"],category:"alchene"},
  {smiles:"C=CCC",iupacRo:"but-1-enă",commonRo:"1-butenă",aliasesRo:["but-1-enă","1-butenă"],category:"alchene"},
  {smiles:"CC=CC",iupacRo:"but-2-enă",commonRo:"2-butenă",aliasesRo:["but-2-enă","2-butenă"],category:"alchene"},
  {smiles:"C=CC(C)C",iupacRo:"3-metilbut-1-enă",commonRo:"3-metil-1-butenă",aliasesRo:["3-metil-1-butenă"],category:"alchene"},
  {smiles:"CC(C)=C",iupacRo:"2-metilprop-1-enă",commonRo:"izobutenă",aliasesRo:["2-metilpropenă","izobutenă"],category:"alchene"},
  {smiles:"C=CC=C",iupacRo:"buta-1,3-dienă",commonRo:"butadienă",aliasesRo:["1,3-butadienă","butadienă"],category:"alchene"},
  {smiles:"C=C(C)C=C",iupacRo:"2-metilbuta-1,3-dienă",commonRo:"izoprenă",aliasesRo:["izoprenă"],category:"alchene"},

  // Alchine
  {smiles:"C#C",iupacRo:"etină",commonRo:"acetilenă",aliasesRo:["etină","acetilenă"],category:"alchine"},
  {smiles:"CC#C",iupacRo:"propină",commonRo:"metilacetilenă",aliasesRo:["propină","metilacetilenă"],category:"alchine"},
  {smiles:"C#CCC",iupacRo:"but-1-ină",commonRo:"1-butină",aliasesRo:["1-butină"],category:"alchine"},
  {smiles:"CC#CC",iupacRo:"but-2-ină",commonRo:"2-butină",aliasesRo:["2-butină"],category:"alchine"},

  // Hidrocarburi aromatice
  {smiles:"c1ccccc1",iupacRo:"benzen",commonRo:"benzen",aliasesRo:[],category:"aromatici"},
  {smiles:"Cc1ccccc1",iupacRo:"metilbenzen",commonRo:"toluen",aliasesRo:["toluen"],category:"aromatici"},
  {smiles:"CCc1ccccc1",iupacRo:"etilbenzen",commonRo:"etilbenzen",aliasesRo:[],category:"aromatici"},
  {smiles:"Cc1ccccc1C",iupacRo:"1,2-dimetilbenzen",commonRo:"o-xilen",aliasesRo:["ortoxilen","o xilen"],category:"aromatici"},
  {smiles:"Cc1ccc(C)cc1",iupacRo:"1,4-dimetilbenzen",commonRo:"p-xilen",aliasesRo:["paraxilen","p xilen"],category:"aromatici"},
  {smiles:"Cc1cccc(C)c1",iupacRo:"1,3-dimetilbenzen",commonRo:"m-xilen",aliasesRo:["metaxilen","m xilen"],category:"aromatici"},
  {smiles:"c1ccc2ccccc2c1",iupacRo:"naftalen",commonRo:"naftalină",aliasesRo:["naftalină"],category:"aromatici"},

  // Derivați halogenați
  {smiles:"CCl",iupacRo:"clorometan",commonRo:"clorură de metil",aliasesRo:["clorura de metil"],category:"halogenati"},
  {smiles:"CCCl",iupacRo:"cloroetan",commonRo:"clorură de etil",aliasesRo:["clorura de etil"],category:"halogenati"},
  {smiles:"ClCCCl",iupacRo:"1,2-dicloroetan",commonRo:"clorură de etilenă",aliasesRo:["dicloroetan"],category:"halogenati"},
  {smiles:"ClC(Cl)Cl",iupacRo:"triclorometan",commonRo:"cloroform",aliasesRo:["cloroform"],category:"halogenati"},
  {smiles:"ClC(Cl)(Cl)Cl",iupacRo:"tetraclorometan",commonRo:"tetraclorură de carbon",aliasesRo:["tetraclorura de carbon"],category:"halogenati"},
  {smiles:"Clc1ccccc1",iupacRo:"clorobenzen",commonRo:"clorobenzen",aliasesRo:[],category:"halogenati"},

  // Alcooli și polialcooli
  {smiles:"CO",iupacRo:"metanol",commonRo:"alcool metilic",aliasesRo:["alcool metilic"],category:"alcooli"},
  {smiles:"CCO",iupacRo:"etanol",commonRo:"alcool etilic",aliasesRo:["alcool etilic"],category:"alcooli"},
  {smiles:"CCCO",iupacRo:"propan-1-ol",commonRo:"alcool n-propilic",aliasesRo:["1-propanol","alcool propilic"],category:"alcooli"},
  {smiles:"CC(O)C",iupacRo:"propan-2-ol",commonRo:"alcool izopropilic",aliasesRo:["2-propanol","izopropanol","alcool izopropilic"],category:"alcooli"},
  {smiles:"CCCCO",iupacRo:"butan-1-ol",commonRo:"alcool n-butilic",aliasesRo:["1-butanol"],category:"alcooli"},
  {smiles:"CCC(O)C",iupacRo:"butan-2-ol",commonRo:"alcool sec-butilic",aliasesRo:["2-butanol"],category:"alcooli"},
  {smiles:"OCCO",iupacRo:"etan-1,2-diol",commonRo:"etilenglicol",aliasesRo:["etilenglicol"],category:"alcooli"},
  {smiles:"OCC(O)CO",iupacRo:"propan-1,2,3-triol",commonRo:"glicerol",aliasesRo:["glicerină","glicerina"],category:"alcooli"},

  // Fenoli
  {smiles:"Oc1ccccc1",iupacRo:"benzenol",commonRo:"fenol",aliasesRo:["fenol","hidroxibenzen"],category:"fenoli"},
  {smiles:"Cc1ccccc1O",iupacRo:"2-metilbenzenol",commonRo:"o-crezol",aliasesRo:["2-metilfenol","ortocrezol","o crezol"],category:"fenoli"},
  {smiles:"Cc1ccc(O)cc1",iupacRo:"4-metilbenzenol",commonRo:"p-crezol",aliasesRo:["4-metilfenol","paracrezol","p crezol"],category:"fenoli"},
  {smiles:"Oc1ccc(O)cc1",iupacRo:"benzen-1,4-diol",commonRo:"hidrochinonă",aliasesRo:["hidrochinona"],category:"fenoli"},
  {smiles:"Oc1ccccc1O",iupacRo:"benzen-1,2-diol",commonRo:"pirocatechină",aliasesRo:["catecol","pirocatechina"],category:"fenoli"},
  {smiles:"Oc1cccc(O)c1",iupacRo:"benzen-1,3-diol",commonRo:"rezorcinol",aliasesRo:["rezorcinol"],category:"fenoli"},

  // Amine
  {smiles:"CN",iupacRo:"metanamină",commonRo:"metilamină",aliasesRo:["metilamina"],category:"amine"},
  {smiles:"CCN",iupacRo:"etanamină",commonRo:"etilamină",aliasesRo:["etilamina"],category:"amine"},
  {smiles:"CCCN",iupacRo:"propan-1-amină",commonRo:"propilamină",aliasesRo:["propilamina","1-propilamină"],category:"amine"},
  {smiles:"CC(N)C",iupacRo:"propan-2-amină",commonRo:"izopropilamină",aliasesRo:["izopropilamina"],category:"amine"},
  {smiles:"Nc1ccccc1",iupacRo:"benzenamină",commonRo:"anilină",aliasesRo:["anilina","fenilamină","fenilamina"],category:"amine"},
  {smiles:"NCCN",iupacRo:"etan-1,2-diamină",commonRo:"etilendiamină",aliasesRo:["etilendiamina"],category:"amine"},

  // Nitroderivați
  {smiles:"C[N+](=O)[O-]",iupacRo:"nitrometan",commonRo:"nitrometan",aliasesRo:[],category:"nitroderivati"},
  {smiles:"O=[N+]([O-])c1ccccc1",iupacRo:"nitrobenzen",commonRo:"nitrobenzen",aliasesRo:[],category:"nitroderivati"},

  // Aldehide și cetone
  {smiles:"C=O",iupacRo:"metanal",commonRo:"formaldehidă",aliasesRo:["formaldehida"],category:"carbonilici"},
  {smiles:"CC=O",iupacRo:"etanal",commonRo:"acetaldehidă",aliasesRo:["acetaldehida"],category:"carbonilici"},
  {smiles:"CCC=O",iupacRo:"propanal",commonRo:"propionaldehidă",aliasesRo:["propionaldehida"],category:"carbonilici"},
  {smiles:"CCCC=O",iupacRo:"butanal",commonRo:"butiraldehidă",aliasesRo:["butiraldehida"],category:"carbonilici"},
  {smiles:"O=Cc1ccccc1",iupacRo:"benzen-carbaldehidă",commonRo:"benzaldehidă",aliasesRo:["benzaldehida"],category:"carbonilici"},
  {smiles:"CC(=O)C",iupacRo:"propanonă",commonRo:"acetonă",aliasesRo:["acetona","dimetilcetonă","dimetilcetona"],category:"carbonilici"},
  {smiles:"CC(=O)CC",iupacRo:"butan-2-onă",commonRo:"metiletilcetonă",aliasesRo:["metil-etil-cetonă","metiletilcetona"],category:"carbonilici"},
  {smiles:"CC(=O)CCC",iupacRo:"pentan-2-onă",commonRo:"metil-propil-cetonă",aliasesRo:["metilpropilcetona"],category:"carbonilici"},
  {smiles:"O=C1CCCCC1",iupacRo:"ciclohexanonă",commonRo:"ciclohexanonă",aliasesRo:[],category:"carbonilici"},

  // Acizi carboxilici și acizi grași
  {smiles:"O=CO",iupacRo:"acid metanoic",commonRo:"acid formic",aliasesRo:["acid formic"],category:"carboxilici"},
  {smiles:"CC(=O)O",iupacRo:"acid etanoic",commonRo:"acid acetic",aliasesRo:["acid acetic"],category:"carboxilici"},
  {smiles:"CCC(=O)O",iupacRo:"acid propanoic",commonRo:"acid propionic",aliasesRo:["acid propionic"],category:"carboxilici"},
  {smiles:"CCCC(=O)O",iupacRo:"acid butanoic",commonRo:"acid butiric",aliasesRo:["acid butiric"],category:"carboxilici"},
  {smiles:"CCCCC(=O)O",iupacRo:"acid pentanoic",commonRo:"acid valerianic",aliasesRo:["acid valerianic","acid valeri anic"],category:"carboxilici"},
  {smiles:"O=C(O)c1ccccc1",iupacRo:"acid benzoic",commonRo:"acid benzoic",aliasesRo:[],category:"carboxilici"},
  {smiles:"O=C(O)C(=O)O",iupacRo:"acid etandioic",commonRo:"acid oxalic",aliasesRo:["acid oxalic"],category:"carboxilici"},
  {smiles:"CCCCCCCCCCCCCCCC(=O)O",iupacRo:"acid hexadecanoic",commonRo:"acid palmitic",aliasesRo:["acid palmitic"],category:"acizi grasi"},
  {smiles:"CCCCCCCCCCCCCCCCCC(=O)O",iupacRo:"acid octadecanoic",commonRo:"acid stearic",aliasesRo:["acid stearic"],category:"acizi grasi"},
  {smiles:"CCCCCCCC/C=C\\CCCCCCCC(=O)O",iupacRo:"acid (Z)-octadec-9-enoic",commonRo:"acid oleic",aliasesRo:["acid oleic"],category:"acizi grasi"},

  // Esteri, amide și nitrili
  {smiles:"COC(=O)C",iupacRo:"etanoat de metil",commonRo:"acetat de metil",aliasesRo:["acetat de metil"],category:"derivati acizi"},
  {smiles:"CCOC(=O)C",iupacRo:"etanoat de etil",commonRo:"acetat de etil",aliasesRo:["acetat de etil"],category:"derivati acizi"},
  {smiles:"CCOC(=O)CC",iupacRo:"propanoat de etil",commonRo:"propionat de etil",aliasesRo:["propionat de etil"],category:"derivati acizi"},
  {smiles:"C(=O)N",iupacRo:"metanamidă",commonRo:"formamidă",aliasesRo:["formamida"],category:"derivati acizi"},
  {smiles:"CC(=O)N",iupacRo:"etanamidă",commonRo:"acetamidă",aliasesRo:["acetamida"],category:"derivati acizi"},
  {smiles:"CC#N",iupacRo:"etanonitril",commonRo:"acetonitril",aliasesRo:["acetonitril"],category:"derivati acizi"},
  {smiles:"N#Cc1ccccc1",iupacRo:"benzonitril",commonRo:"cianură de fenil",aliasesRo:["cianura de fenil"],category:"derivati acizi"},

  // Aminoacizi
  {smiles:"NCC(=O)O",iupacRo:"acid 2-aminoetanoic",commonRo:"glicină",aliasesRo:["glicina"],category:"aminoacizi"},
  {smiles:"CC(N)C(=O)O",iupacRo:"acid 2-aminopropanoic",commonRo:"alanină",aliasesRo:["alanina"],category:"aminoacizi"},
  {smiles:"CC(C)C(N)C(=O)O",iupacRo:"acid 2-amino-3-metilbutanoic",commonRo:"valină",aliasesRo:["valina"],category:"aminoacizi"},
  {smiles:"CC(C)CC(N)C(=O)O",iupacRo:"acid 2-amino-4-metilpentanoic",commonRo:"leucină",aliasesRo:["leucina"],category:"aminoacizi"},
  {smiles:"NCC(O)C(=O)O",iupacRo:"acid 2-amino-3-hidroxipropanoic",commonRo:"serină",aliasesRo:["serina"],category:"aminoacizi"},
  {smiles:"NCC(=O)O",iupacRo:"acid 2-aminoetanoic",commonRo:"glicină",aliasesRo:["glicina"],category:"aminoacizi"},

  // Zaharide - reprezentări aciclice pentru recunoașterea formulei structurale
  {smiles:"O=CC(O)C(O)C(O)C(O)CO",iupacRo:"aldohexoză (glucoză)",commonRo:"glucoză",aliasesRo:["glucoza","d-glucoză","d-glucoza"],category:"zaharide"},
  {smiles:"OCC(=O)C(O)C(O)C(O)CO",iupacRo:"cetohexoză (fructoză)",commonRo:"fructoză",aliasesRo:["fructoza","d-fructoză","d-fructoza"],category:"zaharide"},
  {smiles:"O=CC(O)C(O)C(O)CO",iupacRo:"aldopentoză (riboză)",commonRo:"riboză",aliasesRo:["riboza","d-riboză","d-riboza"],category:"zaharide"},
];

// Alias pentru codul paginii și compatibilitate cu versiunile anterioare.
const UNIQUE_COMPOUNDS = ORGANIC_COMPOUNDS;
if (typeof module !== "undefined" && module.exports) module.exports = { ORGANIC_COMPOUNDS, UNIQUE_COMPOUNDS };
