# #320 AC-23 抜き取りの「その寺社の写真か」の照合（2026-10-10 リーダー）

`ac23-sample.json` の 34 行について、Commons の API（`prop=categories|imageinfo`・隠しカテゴリを除く）でファイルのカテゴリと説明を取り、寺社（名前・seed の住所・Wikidata の項目）と照らした。構図（寺社と分かるものが帯に見えるか）は前回の evaluator の確認（35 枚）のまま。

| idx  | 寺社                       | Commons のカテゴリ（抜粋）                                             | 判定 |
| ---- | -------------------------- | ---------------------------------------------------------------------- | ---- |
| 2    | 札幌諏訪神社               | Suwa-jinja (Sapporo)                                                   | ✅   |
| 4    | 北海道神宮頓宮             | Hokkaido-jingu Tongu                                                   | ✅   |
| 41   | 中尊寺                     | Omotemon, Honbo, Chusonji（本堂へ向かう門。金色堂ではない）            | ✅   |
| 64   | 太平山三吉神社総本宮       | Taiheizan-Miyoshi-jinja（説明「里社（秋田市広面）」= seed の住所）     | ✅   |
| 82   | 出羽神社（出羽三山神社）   | Zuishinmon, Ideha-jinja                                                | ✅   |
| 83   | 宝珠山立石寺               | Oku-no-in, Risshaku-ji（立石寺の奥の院）                               | ✅   |
| 125  | 酒列磯前神社               | Sakatsura Isosaki-jinja（斎館）                                        | ✅   |
| 129  | 常磐神社                   | Tokiwa Jinja（拝殿）                                                   | ✅   |
| 145  | 足利織姫神社               | Ashikaga Orihime-jinja                                                 | ✅   |
| 161  | 榛名神社                   | Haiden / Gakuden, Haruna-jinja                                         | ✅   |
| 185  | 川越熊野神社               | Kawagoe Kumano-jinja                                                   | ✅   |
| 187  | 川越八幡宮                 | Kawagoe Hachiman-gū                                                    | ✅   |
| 226  | 高徳院（鎌倉大仏）         | Front right views of the Kamakura Daibutsu                             | ✅   |
| 241  | 彌彦神社                   | Haiden, Iyahiko-jinja                                                  | ✅   |
| 270  | 雄山神社峰本社             | Mine-honsha                                                            | ✅   |
| 341  | 善光寺                     | Zenkō-ji                                                               | ✅   |
| 347  | 戸隠神社中社               | Otorii, Chusha, Togakushi Shrine（中社の大鳥居。宝光社・奥社ではない） | ✅   |
| 388  | 小國神社                   | Okuni-jinja (Mori)（拝殿）                                             | ✅   |
| 421  | 伊勢神宮内宮（皇大神宮）   | **Naiku**（外宮ではない）                                              | ✅   |
| 422  | 伊勢神宮外宮（豊受大神宮） | Geku（九丈殿）                                                         | ✅   |
| 427  | 伊勢の国 四天王寺          | Sanmon in Shitennō-ji (Tsu, Mie)                                       | ✅   |
| 484  | 湊川神社                   | Minatogawa Shrine（祈祷殿）                                            | ✅   |
| 541  | 白兎神社                   | Hakuto-jinja                                                           | ✅   |
| 608  | 艮神社（尾道）             | Ushitora jinja (Onomichi-nagae)（拝殿。seed の住所は長江）             | ✅   |
| 644  | 極楽寺                     | Gates of Gokuraku-ji (Naruto, Tokushima)（仁王門。seed は鳴門市）      | ✅   |
| 669  | 讃岐宮香川縣護國神社       | Kagawaken-Gokoku-jinja（善通寺市）                                     | ✅   |
| 683  | 湯神社                     | Yu-jinja (Matsuyama)（拝殿）                                           | ✅   |
| 684  | 石鎚神社口之宮本社         | Ishizuchi-jinja（本殿。西条市の口之宮の社殿）                          | ✅   |
| 730  | 東長寺                     | Main Hall, Tōchō-ji（説明に博多区御供所町）                            | ✅   |
| 781  | 阿蘇神社                   | Rōmon, Aso-jinja                                                       | ✅   |
| 790  | 藤崎八旛宮                 | Fujisaki-hachimangu（楼門）                                            | ✅   |
| 801  | 宇佐神宮                   | Minami Chūrōmon, Usa Shrine                                            | ✅   |
| 865  | 護国寺（那覇）             | Gokokuji (Naha)                                                        | ✅   |
| 1006 | 北野天満宮                 | Chumon, Kitano-tenmangu（勅額御門）                                    | ✅   |

34 / 34 がその寺社（同じ境内の別の社ではない）。前回「未確認」だった 421 内宮は、カテゴリ Naiku で内宮と確かめた。
