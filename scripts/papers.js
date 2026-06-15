function Paper(title, language, publisher, date, authors, collections) {
  this.title = title;
  this.language = language;
  this.publisher = publisher;
  this.date = date;
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
    ["Business"],
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
    ["Lifestyle", "Business"]
  ),
  new Paper(
    "Managing Data for Patron Privacy: Comprehensive Strategies for Libraries",
    ["English"],
    ["ALA Editions"],
    "2022-08-08",
    ["Kristin Briney", "Becky Yoose"],
    ["Civil"]
  ),
  new Paper(
    "Anonymity",
    ["English"],
    ["ALA Neal-Schuman"],
    "2019-05-21",
    ["Alison Macrina", "Talya Cooper"],
    ["Civil"]
  ),
  new Paper(
    "A Short Hike",
    ["English", "Spanish - Latin America", "French", "Japanese", "Portuguese - Brazil"],
    ["Whippoorwill"],
    "2019-04-05",
    ["Adam Robinson-Yu", "Adamgryu"],
    ["Entertainment"]
  ),
  new Paper(
    "Grit: The Power of Passion and Perseverance",
    ["English"],
    ["Simon & Schuster"],
    "2016-05-03",
    ["Angela Duckworth"],
    ["Lifestyle", "Personal Resilience"]
  ),
  new Paper(
    "The Life-Changing Magic of Tidying Up: the Japanese Art of Decluttering and Organizing",
    ["English"],
    ["Clarkson Potter/Ten Speed"],
    "2014-10-14",
    ["Marie Kondo"],
    ["Lifestyle"]
  ),
  new Paper(
    "The Food of Sichuan",
    ["English"],
    ["Norton, W. W. & Company"],
    "2019-10-15",
    ["Fuchsia Dunlop"],
    ["Lifestyle"]
  ),
  new Paper(
    "Never Eat Alone, Expanded and Updated: And Other Secrets to Success, One Relationship at a Time",
    ["English"],
    ["Crown Publishing Group"],
    "2014-06-03",
    ["Keith Ferrazzi", "Tahl Raz"],
    ["Lifestyle"]
  ),
  new Paper(
    "Poor Charlie's Almanack: The Essential Wit and Wisdom of Charles T. Munger",
    ["English"],
    ["Stripe Matter, Inc."],
    "2023-12-05",
    ["Charles T. Munger"],
    ["Lifestyle"]
  ),
  new Paper(
    "The Ivy Portfolio: How to Invest Like the Top Endowments and Avoid Bear Markets",
    ["English"],
    ["Wiley"],
    "2011-04-05",
    ["Mebane T. Faber", "Eric W. Richardson"],
    ["Lifestyle"]
  ),
  new Paper(
    "The Wind Rises",
    ["Japanese", "English"],
    ["Studio Ghibli"],
    "2013-07-20",
    ["Hayao Miyazaki", "Toshio Suzuki"],
    ["Entertainment", "Technology", "Societal Resilience"]
  ),
  new Paper(
    "Meditations",
    ["English"],
    ["N/A"],
    "180", // 161-180 C.E. Est.
    ["Marcus Aurelius"],
    ["Lifestyle", "Personal Resilience"]
  ),
  new Paper(
    "Mastery",
    ["English"],
    ["Penguin Books"],
    "2013-10-29",
    ["Robert Greene"],
    ["Lifestyle"]
  ),
  new Paper(
    "On Liberty",
    ["English"],
    ["John W. Parker and Son"],
    "1859",
    ["John Stuart Mill"],
    ["Civil"]
  ),
  new Paper(
    "Individualism and the Economic Order",
    ["English"],
    ["Routledge Press"],
    "1947", // April Suspected.
    ["Friedrich Hayek"],
    ["Civil"]
  ),
  new Paper(
    "Self-Reliance",
    ["English"],
    ["James Munroe and Company"],
    "1841",
    ["Ralph Waldo Emerson"],
    ["Lifestyle"]
  ),
  new Paper(
    "Orb: On the Movements of the Earth",
    ["Japanese", "English", "Spanish - Latin America", "French", "German", "Italian", "Portuguese - Brazil", "Polish", "Arabic", "Simplified Chinese", "Traditional Chinese"],
    ["Studio Madhouse", "Netflix"],
    "2025-03-15",
    ["Shingo Irie", "Kenichi Shimizu", "Tetsuya Nakatake"],
    ["Entertainment", "Personal Resilience", "Societal Resilience"]
  ),
  new Paper(
    "Terror in Resonance",
    ["Japanese", "English", "Spanish - Latin America", "Spanish - Spain", "French", "German", "Italian", "Portuguese - Brazil", "Russian", "Arabic", "Czech", "Hungarian"],
    ["MAPPA", "Aniplex"],
    "2014-09-25",
    ["Shinichirō Watanabe", "Koji Yamamoto", "Takamitsu Inoue"],
    ["Entertainment", "Civil", "Societal Resilience"]
  ),
  new Paper(
    "Psycho-Pass",
    ["Japanese", "English", "Spanish - Latin America", "Spanish - Spain", "French", "German", "Italian", "Portuguese - Brazil", "Russian"],
    ["Production I.G.", "Fuji TV"],
    "2013-03-22",
    ["Gen Urobuchi", "Katsuyuki Motohiro", "Naoyoshi Shiotani", "Makoto Fukami", "Tow Ubukata"],
    ["Entertainment", "Technology", "Civil", "Societal Resilience"]
  ),
  new Paper(
    "Where the Water Tastes Like Wine",
    ["English", "French", "German", "Russian", "Simplified Chinese"],
    ["Dim Bulb Games", "Serenity Forge"],
    "2018-02-28",
    ["Johnnemann Nordhagen", "Rami Ismael", "Cara Ellison", "Leigh Alexander", "Ryan Ike"],
    ["Entertainment", "Societal Resilience"]
  ),
  new Paper(
    "Kentucky Route Zero",
    ["English", "French", "Italian", "German", "Spanish - Spain", "Japanese", "Korean", "Portuguese - Brazil", "Russian", "Simplified Chinese", "Traditional Chinese", "Turkish", "Czech", "Hungarian", "Polish", "Romanian"],
    ["Cardboard Computer", "Annapurna Interactive"],
    "2020-01-28",
    ["Jake Elliott", "Tamas Kemenczy", "Hussein Neemat", "Ben Babbitt"],
    ["Entertainment", "Societal Resilience"]
  ),
  new Paper(
    "Becoming Bulletproof: Protect Yourself, Read People, Influence Situations, and Live Fearlessly",
    ["English"],
    ["Atria Books"],
    "2020-04-21",
    ["Evy Poumpouras"],
    ["Lifestyle", "Personal Resilience"]
  ),
  new Paper(
    "Frostpunk 2",
    ["English", "French", "Italian", "German", "Spanish - Spain", "Japanese", "Korean", "Polish", "Portuguese - Brazil", "Russian", "Simplified Chinese", "Turkish", "Traditional Chinese", "Ukrainian"],
    ["11 bit studios"],
    "2024-09-20",
    ["Alexandre Boiret", "Jakub Dzierżykraj-Stokalski", "Łukasz Juszczyk"],
    ["Entertainment", "Civil", "Societal Resilience"]
  ),
  new Paper(
    "The Apothecary Diaries",
    ["Japanese", "English", "Spanish - Latin America", "French", "German", "Italian", "Portuguese - Brazil", "Arabic", "Hindi", "Indonesian", "Malay", "Thai", "Vietnamese"],
    ["Toho Animation Studio", "OLM", "Crunchyroll"],
    "2023-10-21",
    ["Natsu Hyūga", "Touko Shino", "Norihiro Naganuma"],
    ["Entertainment", "Civil", "Personal Resilience"],
  ),
  new Paper(
    "Night in the Woods",
    ["English", "French", "German", "Spanish - Spain", "Italian", "Portuguese - Brazil", "Russian", "Japanese", "Simplified Chinese"],
    ["Infinite Fall", "Finji"],
    "2017-02-21",
    ["Scott Benson", "Bethany Hockenvberry", "Alec Holowka"],
    ["Entertainment", "Civil", "Personal Resilience", "Societal Resilience"],
  ),
  new Paper(
    "Ascendance of a Bookworm",
    ["Japanese", "English", "Spanish - Latin America", "French", "German", "Italian", "Portuguese - Brazil", "Russian", "Arabic"],
    ["Ajia-do Animation Works", "Crunchyroll"],
    "2019-10-02",
    ["Miya Kazuki", "You Shiina", "Mitsuru Hongo"],
    ["Entertainment", "Technology", "Business", "Personal Resilience", "Societal Resilience"],
  )
];
