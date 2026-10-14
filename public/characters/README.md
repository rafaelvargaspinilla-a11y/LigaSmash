# Retratos de Super Smash Bros. Ultimate

Se incluyen los 86 retratos reales del plantel, guardados localmente. Hay 83 imágenes compactas del [sitio oficial de Nintendo](https://www.smashbros.com/es_ES/fighter/index.html) y tres retratos individuales de Mii de [marcrd/smash-ultimate-assets](https://github.com/marcrd/smash-ultimate-assets/tree/master/portraits/small).

Los Echo mantienen imágenes e IDs separados. Pyra/Mythra usa el retrato conjunto oficial. Entrenador Pokémon usa la imagen de su selección. Los tres tipos de Mii tienen retratos individuales: Luchador, Espadachín y Tirador. El archivo comunitario nombra sus imágenes `.png` pero sus bytes originales son JPEG, por lo que aquí se conservan sin convertir con extensión `.jpg`.

[sources.json](sources.json) contiene el origen exacto, dimensiones, tamaño y SHA-256 de cada archivo. `python scripts/download-portraits.py`, ejecutado desde la raíz del proyecto, permite repetir la descarga de todos los originales y verificar su formato. Las imágenes no se editan ni se generan artificialmente; la interfaz las encuadra con CSS.

Las ilustraciones y los personajes pertenecen a Nintendo y a sus respectivos titulares. La atribución documenta su origen; no declara que estas imágenes sean de dominio público ni transfiere derechos. Proyecto personal no oficial para registrar partidas entre amigos.

| Archivo     | Selección              |
| ----------- | ---------------------- |
| `01.png`    | Mario                  |
| `02.png`    | Donkey Kong            |
| `03.png`    | Link                   |
| `04.png`    | Samus                  |
| `04e.png`   | Samus oscura           |
| `05.png`    | Yoshi                  |
| `06.png`    | Kirby                  |
| `07.png`    | Fox                    |
| `08.png`    | Pikachu                |
| `09.png`    | Luigi                  |
| `10.png`    | Ness                   |
| `11.png`    | Captain Falcon         |
| `12.png`    | Jigglypuff             |
| `13.png`    | Peach                  |
| `13e.png`   | Daisy                  |
| `14.png`    | Bowser                 |
| `15.png`    | Ice Climbers           |
| `16.png`    | Sheik                  |
| `17.png`    | Zelda                  |
| `18.png`    | Dr. Mario              |
| `19.png`    | Pichu                  |
| `20.png`    | Falco                  |
| `21.png`    | Marth                  |
| `21e.png`   | Lucina                 |
| `22.png`    | Link niño              |
| `23.png`    | Ganondorf              |
| `24.png`    | Mewtwo                 |
| `25.png`    | Roy                    |
| `25e.png`   | Chrom                  |
| `26.png`    | Mr. Game & Watch       |
| `27.png`    | Meta Knight            |
| `28.png`    | Pit                    |
| `28e.png`   | Pit sombrío            |
| `29.png`    | Samus Zero             |
| `30.png`    | Wario                  |
| `31.png`    | Snake                  |
| `32.png`    | Ike                    |
| `33-35.png` | Entrenador Pokémon     |
| `36.png`    | Diddy Kong             |
| `37.png`    | Lucas                  |
| `38.png`    | Sonic                  |
| `39.png`    | Rey Dedede             |
| `40.png`    | Olimar                 |
| `41.png`    | Lucario                |
| `42.png`    | R.O.B.                 |
| `43.png`    | Toon Link              |
| `44.png`    | Wolf                   |
| `45.png`    | Aldeano                |
| `46.png`    | Mega Man               |
| `47.png`    | Entrenadora de Wii Fit |
| `48.png`    | Estela y Destello      |
| `49.png`    | Little Mac             |
| `50.png`    | Greninja               |
| `51.jpg`    | Luchador Mii           |
| `52.jpg`    | Espadachín Mii         |
| `53.jpg`    | Tirador Mii            |
| `54.png`    | Palutena               |
| `55.png`    | Pac-Man                |
| `56.png`    | Daraen                 |
| `57.png`    | Shulk                  |
| `58.png`    | Bowsy                  |
| `59.png`    | Dúo Duck Hunt          |
| `60.png`    | Ryu                    |
| `60e.png`   | Ken                    |
| `61.png`    | Cloud                  |
| `62.png`    | Corrin                 |
| `63.png`    | Bayonetta              |
| `64.png`    | Inkling                |
| `65.png`    | Ridley                 |
| `66.png`    | Simon                  |
| `66e.png`   | Richter                |
| `67.png`    | King K. Rool           |
| `68.png`    | Canela                 |
| `69.png`    | Incineroar             |
| `70.png`    | Planta Piraña          |
| `71.png`    | Joker                  |
| `72.png`    | Héroe                  |
| `73.png`    | Banjo y Kazooie        |
| `74.png`    | Terry                  |
| `75.png`    | Byleth                 |
| `76.png`    | Min Min                |
| `77.png`    | Steve                  |
| `78.png`    | Sefirot                |
| `79-80.png` | Pyra / Mythra          |
| `81.png`    | Kazuya                 |
| `82.png`    | Sora                   |

## Sustituir un retrato

Usa el nombre y el formato de la tabla. Sube el archivo en esta carpeta mediante GitHub → Add file → Upload files y confirma el cambio en main. El workflow publicará la nueva imagen para todos. Para actualizar una PWA abierta, cierra sus ventanas y vuelve a abrirla; no borres el almacenamiento del sitio. Sustituir una imagen no cambia las partidas.
