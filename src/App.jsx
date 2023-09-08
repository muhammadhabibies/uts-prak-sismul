import { useEffect, useRef } from "react";
import { $ } from "react-jquery-plugin";
import lamejs from "lamejs";

// declare global variable biar lamejs jalan di versi terbarunya
import MPEGMode from "lamejs/src/js/MPEGMode";
import Lame from "lamejs/src/js/Lame";
import BitStream from "lamejs/src/js/BitStream";

window.MPEGMode = MPEGMode;
window.Lame = Lame;
window.BitStream = BitStream;

const App = () => {
  useEffect(() => {
    let audioCtx;
    let target_size;
    const main = document.getElementById("main");
    const audioFile = document.getElementById("fileinput");
    const sizeSlider = document.getElementById("sizeslider");
    const sizeDisplay = document.getElementById("sizedisplay");
    const loadingIndicator = document.getElementById("loadingindicator");

    // Event listener untuk mengubah ukuran file audio pada slider
    sizeSlider.oninput = (e) => {
      sizeDisplay.innerText = `${e.target.value}mb`;
      target_size = e.target.value * 1000;
    };

    // Event listener untuk memuat file audio
    audioFile.onchange = () => {
      loadAudioFile(audioFile.files);
    };

    // Fungsi untuk menginisialisasi AudioContext
    const initAudioCtx = () => {
      audioCtx = new AudioContext();
    };

    // Fungsi untuk mengkonversi data audio dari float32 menjadi int16
    const f32audioToInt16 = (data) => {
      let len = data.length;
      let i = 0;
      let dataAsInt16Array = new Int16Array(len);

      const convert = (n) => {
        let v = n < 0 ? n * 32768 : n * 32767; // Konversi dalam rentang [-32768, 32767]
        return Math.max(-32768, Math.min(32768, v)); // Clamp nilai dalam rentang tersebut
      };

      while (i < len) dataAsInt16Array[i] = convert(data[i++]);

      return dataAsInt16Array;
    };

    // Fungsi untuk memuat file audio
    const loadAudioFile = (fileList) => {
      if (fileList.length !== 1) return;

      console.log(fileList);

      if (!audioCtx) {
        initAudioCtx();
      }

      loadingIndicator.hidden = false;

      document
        .querySelectorAll(".savebtn")
        .forEach((e) => e.parentNode.removeChild(e));

      let f = fileList[0];
      f.arrayBuffer().then((res) => {
        audioCtx.decodeAudioData(res).then((audioBuffer) => {
          console.log(audioBuffer);

          // Bitrate dihitung agar ukuran file target tercapai
          // Kalikan dengan 8 untuk mendapatkan bit dari byte, kalikan dengan 0.9 sebagai margin of error
          let calculated_kbps = Math.floor(
            (8 * (0.9 * target_size)) / audioBuffer.duration
          );
          let kbps = Math.min(320, calculated_kbps);

          console.log(kbps, calculated_kbps);

          let mp3encoder = new lamejs.Mp3Encoder(
            audioBuffer.numberOfChannels,
            audioBuffer.sampleRate,
            kbps
          );

          let mp3Data = [];

          if (audioBuffer.numberOfChannels === 2) {
            let left = f32audioToInt16(audioBuffer.getChannelData(0));
            let right = f32audioToInt16(audioBuffer.getChannelData(1));

            let sampleBlockSize = 1152; // Bisa diatur sesuai kebutuhan, namun sebaiknya kelipatan dari 576 untuk memudahkan encoder

            for (let i = 0; i < left.length; i += sampleBlockSize) {
              let leftChunk = left.subarray(i, i + sampleBlockSize);
              let rightChunk = right.subarray(i, i + sampleBlockSize);
              let mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
              if (mp3buf.length > 0) {
                mp3Data.push(mp3buf);
              }
            }
          } else if (audioBuffer.numberOfChannels === 1) {
            let samples = f32audioToInt16(audioBuffer.getChannelData(0));

            let sampleBlockSize = 1152; // Bisa diatur sesuai kebutuhan, namun sebaiknya kelipatan dari 576 untuk memudahkan encoder

            for (let i = 0; i < samples.length; i += sampleBlockSize) {
              let sampleChunk = samples.subarray(i, i + sampleBlockSize);
              let mp3buf = mp3encoder.encodeBuffer(sampleChunk);
              if (mp3buf.length > 0) {
                mp3Data.push(mp3buf);
              }
            }
          } else {
            alert("Tidak mendukung lebih dari 2 channel");
            return;
          }

          let mp3buf = mp3encoder.flush(); // menyelesaikan penulisan mp3

          if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
          }

          let blob = new Blob(mp3Data, { type: "audio/mp3" });
          let url = URL.createObjectURL(blob);
          console.log("URL MP3: ", url);

          loadingIndicator.hidden = true;

          // Membuat link untuk menyimpan file
          const save_link = document.createElement("a");
          save_link.href = url;
          save_link.download = "compressed.mp3";
          save_link.innerText = "Save";
          save_link.className = "savebtn";
          main.appendChild(save_link);
        });
      });
    };
  }, []);

  const once = useRef(false);

  useEffect(() => {
    if (once.current === false) {
      $(() => {
        $("#file").change(function () {
          if (this.files.length > 0) {
            $.each(this.files, function (i, v) {
              let reader = new FileReader();

              reader.onload = (e) => {
                let img = new Image();
                img.src = e.target.result;

                img.onload = () => {
                  let storeCanvas = document.createElement("canvas");

                  let value = $("#size").val();

                  img.width = value;
                  img.height = value;

                  let ctx = storeCanvas.getContext("2d");
                  ctx.clearRect(0, 0, storeCanvas.width, storeCanvas.height);
                  storeCanvas.width = img.width;
                  storeCanvas.height = img.height;
                  ctx.drawImage(img, 0, 0, img.width, img.height);

                  $("#img").append(img);

                  let a = document.createElement("a");
                  a.href = storeCanvas.toDataURL("image/png");
                  a.download =
                    v.name.substring(0, v.name.indexOf(".")) + "_resized.png";
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                };
              };

              reader.readAsDataURL(this);
            });
          }
        });
      });

      return () => (once.current = true);
    }
  }, []);

  return (
    <div
      className="container"
      style={{
        // backgroundColor: "#28f1c3",
        backgroundColor: "#ddd",
        color: "#272323",
        minHeight: "100vh",
        overflow: "hidden",
        fontFamily:
          "Trebuchet MS, Lucida Sans Unicode, Lucida Grande, Lucida Sans, Arial, sans-serif",
      }}
    >
      <div className="row d-flex text-center justify-content-center">
        <div className="col-6">
          <div id="main">
            <h1 style={{ fontSize: "3rem" }} className="py-2">
              Audio Compress
            </h1>

            <div>
              <input
                style={{ width: "300px" }}
                type="range"
                min="2"
                max="100"
                step="2"
                id="sizeslider"
                defaultValue={8}
              />

              <div style={{ fontSize: "2rem" }} id="sizedisplay">
                8mb
              </div>
            </div>

            <div className="my-3">
              <input
                id="fileinput"
                type="file"
                aria-label="file input button"
              />
            </div>

            <div id="loadingindicator" hidden>
              Compressing...
            </div>
          </div>
        </div>

        <div className="col-6">
          <div>
            <h1 style={{ fontSize: "3rem" }} className="py-2">
              Resize Image
            </h1>

            <input
              type="number"
              style={{ width: "50px" }}
              id="size"
              defaultValue={32}
            />

            <span className="ms-2">px</span>

            <div className="my-3">
              <input type="file" id="file" multiple />
            </div>

            <div id="img"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
