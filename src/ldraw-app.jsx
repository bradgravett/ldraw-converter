import React, { useState, useRef } from 'react';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';
import * as THREE from 'three';

function LDrawConverter() {
    const [ldrawData, setLDrawData] = useState('');
    const [gltfUrls, setGltfUrls] = useState([]);
    const [objUrls, setObjUrls] = useState([]);
    const [stlUrls, setStlUrls] = useState([]);
    const [glbUrls, setGlbUrls] = useState([]);
    const [error, setError] = useState(null);
    const [exportFormat, setExportFormat] = useState('gltf');
    const dropZoneRef = useRef(null);

    const parseColor = (colorCode) => {
        const colorMap = {
            "16": [0, 0, 0],
            "15": [255, 255, 255],
            "4": [255, 0, 0],
            "11": [0, 255, 0],
            "1": [0, 0, 255],
            "12": [255, 255, 0],
        };

        if (colorMap[colorCode]) {
            return colorMap[colorCode].map(c => c / 255.0);
        } else {
            return [0.5, 0.5, 0.5];
        }
    };

    const convertLDrawToModel = (data, filename) => {
        try {
            const vertices = [];
            const faces = [];
            const colors = [];
            let currentColor = null;

            data.split('\n').forEach(line => {
                const parts = line.split(' ');
                if (!parts[0]) return;
                const lineType = parts[0];

                if (lineType === '3' || lineType === '4') {
                    const colorCode = parts[1];
                    const v1 = new THREE.Vector3(parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4]));
                    const v2 = new THREE.Vector3(parseFloat(parts[5]), parseFloat(parts[6]), parseFloat(parts[7]));
                    const v3 = new THREE.Vector3(parseFloat(parts[8]), parseFloat(parts[9]), parseFloat(parts[10]));
                    let v4;

                    if (lineType === '4') {
                        v4 = new THREE.Vector3(parseFloat(parts[11]), parseFloat(parts[12]), parseFloat(parts[13]));
                    }

                    if (colorCode !== currentColor) {
                        currentColor = colorCode;
                        const [r, g, b] = parseColor(colorCode);
                        for (let i = 0; i < (lineType === '3' ? 3 : 4); i++) {
                            colors.push(r, g, b);
                        }
                    }

                    vertices.push(v1, v2, v3);
                    faces.push(vertices.length - 3, vertices.length - 2, vertices.length - 1);

                    if (lineType === '4') {
                        vertices.push(v4);
                        faces.push(vertices.length - 4, vertices.length - 2, vertices.length - 1);
                    }
                }
            });

            const geometry = new THREE.BufferGeometry();
            const positionArray = new Float32Array(vertices.flatMap(v => [v.x, v.y, v.z]));
            const colorArray = new Float32Array(colors);
            const indexArray = new Uint32Array(faces);

            geometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
            geometry.setIndex(new THREE.BufferAttribute(indexArray, 1));

            const material = new THREE.MeshBasicMaterial({ vertexColors: true });
            const mesh = new THREE.Mesh(geometry, material);

            const exportModel = (exporter, extension, setUrls) => {
                exporter.parse(
                    mesh,
                    (result) => {
                        const output = extension === 'gltf' ? JSON.stringify(result, null, 2) : result;
                        const blob = new Blob([output], { type: `model/<span class="math-inline">\{extension\}</span>{extension === 'gltf' ? '+json' : ''}` });
                        const url = URL.createObjectURL(blob);
                        setUrls((prevUrls) => [...prevUrls, { url, filename: `<span class="math-inline">\{filename\}\.</span>{extension}` }]);
                    },
                    (error) => {
                        console.error(`An error happened during ${extension} export:`, error);
                        setError(`Export to ${extension.toUpperCase()} for ${filename} failed.`);
                    }
                );
            };

            switch (exportFormat) {
                case 'gltf':
                    exportModel(new GLTFExporter(), 'gltf', setGltfUrls);
                    break;
                case 'glb':
                    exportModel(new GLTFExporter(), 'glb', setGlbUrls);
                    break;
                case 'obj':
                    exportModel(new OBJExporter(), 'obj', setObjUrls);
                    break;
                case 'stl':
                    exportModel(new STLExporter(), 'stl', setStlUrls);
                    break;
                default:
                    setError('Invalid export format.');
            }

        } catch (err) {
            console.error('Error during conversion:', err);
            setError(`Invalid LDraw data for ${filename}.`);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const items = e.dataTransfer.items;
        if (items) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.kind === 'file' && item.webkitGetAsEntry().isDirectory) {
                    const reader = item.webkitGetAsEntry().createReader();
                    reader.readEntries((entries) => {
                        entries.forEach((entry) => {
                            if (entry.isFile && (entry.name.endsWith('.ldr') || entry.name.endsWith('.dat'))) {
                                entry.file((file) => {
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                        convertLDrawToModel(event.target.result, entry.name.split('.')[0]);
                                    };
                                    reader.readAsText(file);
                                });
                            }
                        });
                    });
                } else if (item.kind === 'file') {
                    const file = item.getAsFile();
                    if (file.name.endsWith('.ldr') || file.name.endsWith('.dat')) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            convertLDrawToModel(event.target.result, file.name.split('.')[0]);
                        };
                        reader.readAsText(file);
                    }
                }
            }
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    return (
        <div>
            <h1>LDraw to 3D Model Converter</h1>
            <div ref={dropZoneRef} onDrop={handleDrop} onDragOver={handleDragOver} style={{ border: '2px dashed gray', padding: '20px', marginBottom: '20px' }}>
                Drag and drop a folder of LDraw files here
            </div>
            <textarea
                value={ldrawData}
                onChange={(e) => setLDrawData(e.target.value)}
                rows="10"
                cols="80"
                placeholder="Paste LDraw data here"
            />
            <br />
            <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
                <option value="gltf">glTF (.gltf)</option>
                <option value="glb">glTF Binary (.glb)</option>
                <option value="obj">OBJ (.obj)</option>
                <option value="stl">STL (.stl)</option>
            </select>
            <button onClick={() => convertLDrawToModel(ldrawData, 'single_file')}>Convert</button>
            {gltfUrls.map((file) => (<p key={file.filename}><a href={file.url} download={file.filename}>Download {file.filename}</a></p>))}
            {glbUrls.map((file) => (<p key={file.filename}><a href={file.url} download={file.filename}>Download {file.filename}</a></p>))}
            {objUrls.map((file) => (<p key={file.filename}><a href={file.url} download={file.filename}>Download {file.filename}</a></p>))}
            {stlUrls.map((file) => (<p key={file.filename}><a href={file.url} download={file.filename}>Download {file.filename}</a></p>))}
            {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
    );
}

export default LDrawConverter;