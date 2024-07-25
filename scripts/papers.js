function Paper(title, language, publisher, date, authors, collections) {
  this.title = title;
  this.language = language;
  this.publisher = publisher;
  this.date = new Date(date);
  this.authors = authors;
  this.collections = collections;
}

var papers = [
  new Paper(
    "Ethical Machines",
    ["English"],
    ["Harvard Business Review Press"],
    "2022-09-20",
    ["Reid Blackman"],
    ["Business", "Technology"],
  ),
  new Paper(
    "Getting to Maybe: How to Excel on Law School Exams",
    ["English"],
    ["Carolina Academic Press"],
    "1999-05-26",
    ["Richard Fischl", "Jeremy Paul"],
    ["Legal"],
  ),
  new Paper(
    "Commencer à Vivre Humainement - Lettres",
    ["French"],
    ["LIBERTALIA"],
    "2022-01-11",
    ["Rosa Luxemburg"],
    ["Civil"]
  ),
  new Paper(
    "La police du futur - le marché de la violence et ce qui lui résiste",
    ["French"],
    ["Revue du Crieur"],
    "2022-03-17",
    ["Mathieu Rigouste"],
    ["Civil"]
  ),
  new Paper(
    "Défaire la police",
    ["French"],
    ["Divergences"],
    "2021-11-15",
    ["Jérôme Baschet", "Elsa Dorlin", "Irene", "Guy Lerouge", "Serge Quadruppani", "Collectif"],
    ["Civil"]
  ),
  new Paper(
    "Modern Grantmaking: A Guide for Funders who Believe Better Is Possible",
    ["English"],
    ["Modern Grantmaking"],
    "2022-05-22",
    ["Gemma Bull", "Tom Steinberg"],
    ["Business"]
  ),
  new Paper(
    "Brief: Make a Bigger Impact by Saying Less",
    ["English"],
    ["Wiley"],
    "2014-02-10",
    ["Joseph McCormack"],
    ["Communication"]
  ),
  new Paper(
    "Nice Racism: How Progressive White People Perpetuate Racial Harm",
    ["English"],
    ["Beacon Press"],
    "2021-06-29",
    ["Robin Diangelo"],
    ["Social"]
  ),
  new Paper(
    "Revolutionary Mathematics: Artificial Intelligence, Statistics and the Logic of Capitalism",
    ["English"],
    ["Verso"],
    "2022-01-18",
    ["Justin Joque"],
    ["Technology", "Business", "Civil"]
  ),
  new Paper(
    "Masked by Trust: Bias in Library Discovery",
    ["English"],
    ["Library Juice Press"],
    "2019-06-01",
    ["Matthew Reidsma"],
    ["Libraries"]
  ),
  new Paper(
    "Managing Data for Patron Privacy: Comprehensive Strategies for Libraries",
    ["English"],
    ["ALA Editions"],
    "2022-08-08",
    ["Kristin Briney", "Becky Yoose"],
    ["Libraries"]
  ),
  new Paper(
    "Anonymity",
    ["English"],
    ["ALA Neal-Schuman"],
    "2019-05-21",
    ["Alison Macrina", "Talya Cooper"],
    ["Libraries"]
  ),
  new Paper(
    "Algorithms of Oppression: How Search Engines Reinforce Racism",
    ["English"],
    ["NYU Press"],
    "2018-02-20",
    ["Safiya Umoja Noble"],
    ["Technology", "Social", "Civil"]
  ),
  new Paper(
    "Night in the Woods",
    ["English", "Japanese"],
    ["Finji"],
    "2017-02-21",
    ["Infinite Fall"],
    ["Gaming"]
  ),
  new Paper(
    "A Short Hike",
    ["English", "Spanish - Latin America", "French", "Japanese", "Portuguese - Brazil"],
    ["Whippoorwill"],
    "2019-04-05",
    ["Adam Robinson-Yu", "Adamgryu"],
    ["Gaming"]
  ),
  new Paper(
    "Kentucky Route Zero",
    ["English", "Spanish - Latin America", "Spanish - Spain", "Portuguese - Brazil", "Russian", "Arabic", "French", "German", "Italian", "Japanese", "Korean", "Polish", "Simplified Chinese", "Traditional Chinese", "Swedish", "Thai", "Turkish"],
    ["Annapurna Interactive"],
    "2020-01-28",
    ["Cardboard Computer"],
    ["Gaming"]
  ),
  new Paper(
    "Where the Water Tastes Like Wine",
    ["English", "French", "German", "Russian", "Simplified Chinese"],
    ["Good Shepherd Entertainment", "Serenity Forge"],
    "2018-02-28",
    ["Dim Bulb Games", "Serenity Forge"],
    ["Gaming"]
  ),
  new Paper(
    "Grit: The Power of Passion and Perseverance",
    ["English"],
    ["Simon & Schuster"],
    "2016-05-03",
    ["Angela Duckworth"],
    ["Productivity"]
  )
];
