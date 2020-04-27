# General instructions for building for pip distribution

After changing `setup.py` or any part of the JupyterTerminals codebase, increase the version number in setup.py appropriately, around line 37.

Then run the commands shown below to upgrade what's stored in pip

``` shell
python3 setup.py prep_to_build npm_run_build sdist bdist_wheel
```

Uploading to the pypi test servers:

``` shell
python3 -m twine upload --repository-url https://test.pypi.org/legacy/ dist/* --verbose
```

(For User name you can use `willkessler`.)

Installing to a host in the cloud, from the test servers:
``` shell
python3 -m pip install --index-url https://test.pypi.org/simple/ jupyterterminals
```

Testing new installation on cloud host:

``` shell
jupyter notebook —port=3001 —ip=127.0.0.1 —allow-root
```

Uploading to the pypi production servers:

``` shell
python3 -m twine upload dist/*
```

(For User name you can use `willkessler`.)

# General instructions for building for conda distribution


NB: this relies on jupyterterminals being in the main (production) pypi repository.
First time steps:

```
mkdir conda
cd conda
rm -rf jupyterterminals
conda skeleton pypi jupyterterminals
conda install conda-verify
```

Modify `jupyterterminals/meta.yaml` to include `build   noarch:  python`.
Modify `jupyterterminals/meta.json` to include github handle: `willkessler`


(Re)building on macosx:

(After you make updates, make sure to bump the version number in `jupyterterminals/meta.yml`.

```
conda build jupyterterminals
export TERMINALS_VERSION=0.1.1
anaconda upload /Users/will/anaconda/conda-bld/noarch/jupyterterminals-$TERMINALS_VERSION-py_0.tar.bz2
```

Then you want to convert to other architectures and upload these as well:

```
conda convert --platform all ~/anaconda/conda-bld/osx-64/jupyterterminals-$TERMINALS_VERSION-py36_0.tar.bz2 -o linux64_out
anaconda upload linux64_out/linux-64/jupyterterminals-$TERMINALS_VERSION-py36_0.tar.bz2
```
... etc for all the architectures you want to support. This last step doesn't seem to be necessary any more (01/23/2020).


To install you should be able to do :

```
conda install -c willkessler jupyterterminals
```

### Building for Windows and building for pip on Windows

To debug issues on Windows, you need to have cygwin64 and node installed on the system. Then you need to use `jupyterterminals/package.json_windows` instead of `jupyterterminals/package.json`. This version of `package.json` has a different build step using utilities provided by Cygwin:

```
...
  "scripts": {
    "build": "/cygwin64/bin/rm.exe -rf terminals-dist build ../build_for_pip/code-prep && node node_modules/gulp/bin/gulp.js prebuild && cd node_modules/.bin && r_js.cmd -o ../../build.js && cd ../.. && node ./node_modules/gulp/bin/gulp.js moveStyles && cd node_modules/.bin && r_js.cmd -o ../../../build_for_pip/buildPip.js && cd ../.. && node ./node_modules/gulp/bin/gulp.js pipMoveStyles"
  },
...
```

You can follow the steps above to build for pip. For creating the pip artifact, from this directory do:

```
python3 setup.py prep_to_build npm_run_build sdist bdist_wheel
```

but then you can install from this build, without uploading to pypi servers, by simply :

1. unpacking the tarball found in the dist directory
1. switching to the unpack directory
1. finally: `pip install .`


